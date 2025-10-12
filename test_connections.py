import os
import boto3
import modal
import sqlalchemy
from dotenv import load_dotenv

# --- Step 1: Load the .env file ---
# This is the most important step. It loads all your secret keys
# from the .env file into the environment for this script to use.
print("--- Loading .env file ---")
if load_dotenv():
    print("✅ .env file loaded successfully.")
else:
    print("❌ ERROR: Could not find or load the .env file. Make sure it's in the same directory.")
    exit()

# --- Step 2: Test Modal Connection ---
print("\n--- Testing Modal.com Connection ---")
try:
    # Modal uses the tokens you set up with `modal token set`
    # but we can also check if the .env variables are present.
    if os.getenv("MODAL_TOKEN_ID") and os.getenv("MODAL_TOKEN_SECRET"):
        print("✅ Modal tokens found in .env file.")
        # This is a simple check that doesn't actually connect,
        # as the CLI `modal token set` already verified the connection.
        print("✅ Modal CLI setup is assumed to be correct.")
    else:
        print("❌ ERROR: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET not found in .env file.")
except Exception as e:
    print(f"❌ ERROR connecting to Modal: {e}")

# --- Step 3: Test PostgreSQL (Render.com) Connection ---
print("\n--- Testing PostgreSQL (Render.com) Connection ---")
db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("❌ ERROR: DATABASE_URL not found in .env file.")
else:
    try:
        engine = sqlalchemy.create_engine(db_url)
        with engine.connect() as connection:
            print("✅ Successfully connected to the PostgreSQL database on Render.com.")
    except Exception as e:
        print(f"❌ ERROR connecting to PostgreSQL: {e}")

# --- Step 4: Test AWS S3 Connection ---
print("\n--- Testing AWS S3 Connection ---")
aws_key_id = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
aws_region = os.getenv("AWS_S3_REGION_NAME")
aws_bucket = os.getenv("AWS_S3_BUCKET_NAME")

if not all([aws_key_id, aws_secret_key, aws_region, aws_bucket]):
    print("❌ ERROR: One or more AWS variables are missing from your .env file.")
else:
    try:
        s3 = boto3.client(
            's3',
            aws_access_key_id=aws_key_id,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        # This command will fail if credentials or region are wrong,
        # but succeed (even with an empty list) if they are correct.
        s3.list_buckets()
        print("✅ Successfully authenticated with AWS.")

        # Optional: Check if the specific bucket exists
        try:
            s3.head_bucket(Bucket=aws_bucket)
            print(f"✅ Successfully connected to your S3 bucket: '{aws_bucket}'.")
        except Exception as e:
            print(f"❌ ERROR: Could not access the bucket '{aws_bucket}'. Check the bucket name and permissions. Error: {e}")

    except Exception as e:
        print(f"❌ ERROR authenticating with AWS: {e}")

print("\n--- Test Complete ---")