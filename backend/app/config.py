from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    jwt_secret: str = "dev-secret"
    groq_api_key: str = ""
    africastalking_api_key: str = ""
    africastalking_username: str = ""

    # M-Pesa Daraja — used for STK Push (money INTO Default Zero, e.g. a savings goal
    # contribution). NOT used for reading a user's general M-Pesa spending — Daraja has
    # no API for that; general spending is covered by the SMS import path instead.
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""       # your Paybill or Till number
    mpesa_passkey: str = ""         # Lipa Na M-Pesa Online passkey, from Daraja portal
    mpesa_callback_url: str = ""    # your deployed backend URL + /finance/mpesa/callback
    mpesa_env: str = "sandbox"      # 'sandbox' | 'production'

    # Shared secret for internal-only endpoints (e.g. scheduled nudge jobs) — never exposed
    # to the app itself, only to whatever calls these routes from outside (a cron job, etc.)
    internal_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
