# =========================================
# 1. IMPORTS + CONFIG
# =========================================

import json
import requests
import boto3


PACKAGE_URL = "https://data.boston.gov/api/3/action/package_show"

PACKAGE_ID = "8048697b-ad64-4bfc-b090-ee00169f2323" # dataset ID for the Boston 311 dataset

DATASTORE_URL = "https://data.boston.gov/api/3/action/datastore_search" # URL for the datastore search endpoint

YEARS_TO_INGEST = [2025, 2026] # years for which to ingest data

PAGE_SIZE = 5000 # number of records to fetch per page, based on the CKAN API's limit in the documentation

S3_BUCKET = "kam-bos-311-rats" # target S3 bucket for storing the ingested data

AWS_REGION = "us-east-2" # region for the S3 bucket


s3 = boto3.client( # establish a connection to the S3 service using boto3
    "s3",
    region_name=AWS_REGION
)

# =========================================
# 2. HELPER FUNCTIONS
# =========================================


def get_package():
    response = requests.get(
    PACKAGE_URL,
    params={
        "id": PACKAGE_ID
    },
    timeout=30
)

response.raise_for_status()

data = response.json()

if not data["success"]:
    raise RuntimeError(
        "CKAN package_show request failed"
    )

dataset = data["result"]

print("TITLE:", dataset["title"])
print("NAME:", dataset["name"])
print("ID:", dataset["id"])


def find_year_resources(dataset):
    pass


def get_rodent_reports(year, resource_id):
    pass


def save_year_to_s3(year, records):
    pass


def to_float(value):
    pass


def create_geojson(records):
    pass


def save_geojson_to_s3(geojson):
    pass

# =========================================
# 3. PIPELINE
# =========================================


def run_pipeline(): # contains steps of the pipeline
    # Step 1: Download the data from the source
    download_data()

    # Step 2: Transform the data
    transform_data()

    # Step 3: Upload the transformed data to S3
    upload_to_s3()

# =========================================
# 4. LAMBDA ENTRY POINT
# =========================================

def lambda_handler(event, context): # AWS knows to call this function when the Lambda is invoked
    run_pipeline()