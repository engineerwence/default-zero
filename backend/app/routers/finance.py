import re
import base64
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from ..database import supabase, get_current_user
from ..schemas import FinanceTransactionCreate, FinanceGoalCreate, STKPushIn, SMSImportBatch
from ..config import settings

router = APIRouter(prefix="/finance", tags=["finance"])

# ---------------------------------------------------------------------------
# Manual transactions
# ---------------------------------------------------------------------------

@router.post("/transactions")
def create_transaction(payload: FinanceTransactionCreate, user=Depends(get_current_user)):
    if payload.type not in ("income", "expense", "savings"):
        raise HTTPException(status_code=400, detail="type must be income, expense, or savings")

    row = {
        "user_id": user.id,
        "amount": payload.amount,
        "type": payload.type,
        "category": payload.category,
        "note": payload.note,
        "source": "manual",
    }
    if payload.occurred_at:
        row["occurred_at"] = payload.occurred_at.isoformat()

    response = supabase.table("finance_transactions").insert(row).execute()
    return response.data


@router.get("/transactions")
def list_transactions(limit: int = 50, user=Depends(get_current_user)):
    response = (
        supabase.table("finance_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("occurred_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


# ---------------------------------------------------------------------------
# Analytics — the actual "good financial behaviour" insight layer
# ---------------------------------------------------------------------------

@router.get("/summary")
def finance_summary(user=Depends(get_current_user)):
    response = (
        supabase.table("finance_transactions")
        .select("amount, type, category, occurred_at")
        .eq("user_id", user.id)
        .execute()
    )
    rows = response.data or []

    total_income = sum(r["amount"] for r in rows if r["type"] == "income")
    total_expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    total_savings = sum(r["amount"] for r in rows if r["type"] == "savings")

    savings_rate = round((total_savings / total_income) * 100, 1) if total_income > 0 else 0.0

    # Spend by category, largest first — the actual "where is it going" view
    by_category = {}
    for r in rows:
        if r["type"] == "expense":
            key = r.get("category") or "uncategorized"
            by_category[key] = by_category.get(key, 0) + r["amount"]
    top_categories = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)[:5]

    # Monthly trend — last 6 months, income vs expense, so the app can chart it
    monthly = {}
    for r in rows:
        month_key = r["occurred_at"][:7]  # 'YYYY-MM'
        bucket = monthly.setdefault(month_key, {"income": 0.0, "expense": 0.0, "savings": 0.0})
        bucket[r["type"]] += r["amount"]
    monthly_sorted = dict(sorted(monthly.items())[-6:])

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "total_savings": total_savings,
        "savings_rate_percent": savings_rate,
        "top_categories": [{"category": c, "amount": a} for c, a in top_categories],
        "monthly": monthly_sorted,
    }


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------

@router.post("/goals")
def create_goal(payload: FinanceGoalCreate, user=Depends(get_current_user)):
    response = supabase.table("finance_goals").insert({
        "user_id": user.id,
        "title": payload.title,
        "target_amount": payload.target_amount,
        "deadline": payload.deadline,
    }).execute()
    return response.data


@router.get("/goals")
def list_goals(user=Depends(get_current_user)):
    goals = supabase.table("finance_goals").select("*").eq("user_id", user.id).execute().data or []
    savings_rows = (
        supabase.table("finance_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "savings")
        .execute()
        .data
        or []
    )
    total_saved = sum(r["amount"] for r in savings_rows)

    # TODO: once goals can be tagged to specific transactions (not just a global savings
    # pool), replace this with per-goal progress instead of applying the same total to all.
    for g in goals:
        g["progress_amount"] = total_saved
        g["progress_percent"] = round(min(total_saved / g["target_amount"], 1) * 100, 1) if g["target_amount"] else 0

    return goals


# ---------------------------------------------------------------------------
# M-Pesa Daraja — STK Push, for money INTO Default Zero (e.g. a goal contribution)
# ---------------------------------------------------------------------------

def _daraja_base_url() -> str:
    return "https://api.safaricom.co.ke" if settings.mpesa_env == "production" else "https://sandbox.safaricom.co.ke"


async def _get_daraja_token() -> str:
    credentials = base64.b64encode(f"{settings.mpesa_consumer_key}:{settings.mpesa_consumer_secret}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_daraja_base_url()}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


@router.post("/mpesa/stkpush")
async def initiate_stk_push(payload: STKPushIn, user=Depends(get_current_user)):
    if not settings.mpesa_consumer_key:
        raise HTTPException(status_code=503, detail="M-Pesa is not configured yet — add Daraja credentials to backend/.env")

    token = await _get_daraja_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.mpesa_shortcode}{settings.mpesa_passkey}{timestamp}".encode()
    ).decode()

    body = {
        "BusinessShortCode": settings.mpesa_shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(payload.amount),
        "PartyA": payload.phone_number,
        "PartyB": settings.mpesa_shortcode,
        "PhoneNumber": payload.phone_number,
        "CallBackURL": settings.mpesa_callback_url,
        "AccountReference": "DefaultZero",
        "TransactionDesc": "Default Zero savings contribution",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_daraja_base_url()}/mpesa/stkpush/v1/processrequest",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
        )
        data = resp.json()

    checkout_id = data.get("CheckoutRequestID")
    if not checkout_id:
        raise HTTPException(status_code=502, detail=f"STK push failed: {data}")

    # Stored so the callback below (which has no idea who our user is) can match it back
    supabase.table("mpesa_stk_requests").insert({
        "user_id": user.id,
        "goal_id": payload.goal_id,
        "checkout_request_id": checkout_id,
        "amount": payload.amount,
    }).execute()

    return {"status": "sent", "checkout_request_id": checkout_id}


@router.post("/mpesa/callback")
async def mpesa_callback(request: Request):
    """Public webhook — Safaricom calls this directly, so there's no user auth token here.
    We identify the user via the CheckoutRequestID we stored when the STK push was sent."""
    payload = await request.json()
    result = payload.get("Body", {}).get("stkCallback", {})
    checkout_id = result.get("CheckoutRequestID")
    success = result.get("ResultCode") == 0

    stk_request = (
        supabase.table("mpesa_stk_requests")
        .select("*")
        .eq("checkout_request_id", checkout_id)
        .maybe_single()
        .execute()
    )
    if not stk_request.data:
        return {"status": "ignored"}  # unknown checkout id, nothing to match it to

    supabase.table("mpesa_stk_requests").update({
        "status": "confirmed" if success else "failed"
    }).eq("checkout_request_id", checkout_id).execute()

    if success:
        metadata = {item["Name"]: item.get("Value") for item in result.get("CallbackMetadata", {}).get("Item", [])}
        supabase.table("finance_transactions").insert({
            "user_id": stk_request.data["user_id"],
            "amount": stk_request.data["amount"],
            "type": "savings",
            "category": "mpesa_savings",
            "source": "mpesa_stk",
            "mpesa_receipt": metadata.get("MpesaReceiptNumber"),
        }).execute()

    return {"status": "processed"}


# ---------------------------------------------------------------------------
# SMS import — the real mechanism for tracking a user's general M-Pesa spending,
# since Daraja has no API for reading someone's own transaction history.
# The frontend reads the user's own SMS inbox (native module, real device build
# required) and posts the raw text here; parsing happens server-side.
# ---------------------------------------------------------------------------

SMS_PATTERNS = [
    # "Ksh500.00 sent to JOHN DOE 0712345678 on 25/7/26"
    (re.compile(r"Ksh([\d,]+\.\d{2}) sent to ([A-Za-z .]+?) \d", re.IGNORECASE), "expense"),
    # "Ksh200.00 paid to SUPERMARKET."
    (re.compile(r"Ksh([\d,]+\.\d{2}) paid to ([A-Za-z0-9 .]+?)\.", re.IGNORECASE), "expense"),
    # "You have received Ksh1,000.00 from JANE DOE"
    (re.compile(r"received Ksh([\d,]+\.\d{2}) from ([A-Za-z .]+?) \d", re.IGNORECASE), "income"),
    # "Ksh100.00 withdrawn"
    (re.compile(r"Ksh([\d,]+\.\d{2}) withdrawn", re.IGNORECASE), "expense"),
]


def parse_mpesa_sms(text: str):
    """Best-effort parse of a single M-Pesa confirmation SMS. Real M-Pesa message wording
    varies (agent withdrawals, Fuliza, Buy Goods vs Paybill, etc.) — this covers the common
    cases. Anything it can't confidently parse is returned as None and skipped rather than
    guessed at, since a wrong auto-categorization is worse than a missed one."""
    if "M-PESA" not in text.upper() and "MPESA" not in text.upper():
        return None

    for pattern, txn_type in SMS_PATTERNS:
        match = pattern.search(text)
        if match:
            amount = float(match.group(1).replace(",", ""))
            counterparty = match.group(2).strip() if match.lastindex and match.lastindex >= 2 else None
            return {
                "amount": amount,
                "type": txn_type,
                "category": counterparty or "uncategorized",
                "note": text[:200],
            }
    return None


@router.post("/import/sms")
def import_sms_batch(payload: SMSImportBatch, user=Depends(get_current_user)):
    inserted = 0
    skipped = 0

    for line in payload.messages:
        parsed = parse_mpesa_sms(line.raw_text)
        if not parsed:
            skipped += 1
            continue

        supabase.table("finance_transactions").insert({
            "user_id": user.id,
            "amount": parsed["amount"],
            "type": parsed["type"],
            "category": parsed["category"],
            "note": parsed["note"],
            "source": "mpesa_sms",
        }).execute()
        inserted += 1

    return {"imported": inserted, "skipped": skipped}
