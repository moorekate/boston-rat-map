import json
import requests
import boto3


# -----------------------------------------
# CONFIGURATION
# -----------------------------------------

PACKAGE_URL = "https://data.boston.gov/api/3/action/package_show"

PACKAGE_ID = "8048697b-ad64-4bfc-b090-ee00169f2323"

DATASTORE_URL = "https://data.boston.gov/api/3/action/datastore_search"

YEARS_TO_INGEST = [2025, 2026]

PAGE_SIZE = 5000

S3_BUCKET = "kam-bos-311-rats"

AWS_REGION = "us-east-2"

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION
)


# -----------------------------------------
# STEP 1: GET THE BOSTON 311 PACKAGE
# -----------------------------------------

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


# -----------------------------------------
# STEP 2: FIND 2025 + 2026 RESOURCES
# -----------------------------------------

resources = dataset["resources"]

year_resources = {}

for resource in resources:

    resource_name = resource.get("name") or ""

    for year in YEARS_TO_INGEST:

        if str(year) in resource_name:

            year_resources[year] = {
                "id": resource["id"],
                "name": resource_name
            }


for year in YEARS_TO_INGEST:

    if year not in year_resources:

        raise RuntimeError(
            f"Could not find CKAN resource for {year}"
        )


print("\nResources selected:")

for year, resource in year_resources.items():

    print(
        year,
        resource["name"],
        resource["id"]
    )


# -----------------------------------------
# STEP 3: PULL RODENT RECORDS
# -----------------------------------------

def get_rodent_reports(year, resource_id):

    records = []

    offset = 0

    while True:

        params = {
            "resource_id": resource_id,

            "filters": json.dumps({
                "type": "Rodent Activity"
            }),

            "limit": PAGE_SIZE,

            "offset": offset
        }

        response = requests.get(
            DATASTORE_URL,
            params=params,
            timeout=30
        )

        response.raise_for_status()

        data = response.json()

        if not data["success"]:

            raise RuntimeError(
                f"CKAN datastore_search failed for {year}"
            )

        result = data["result"]

        page = result["records"]


        for record in page:

            record["source_year"] = year


        records.extend(page)


        print(
            f"{year}: "
            f"{len(records):,} / "
            f"{result['total']:,}"
        )


        if len(page) < PAGE_SIZE:

            break


        offset += PAGE_SIZE


    return records


# -----------------------------------------
# STEP 4: SAVE EACH YEAR TO S3
# -----------------------------------------

def save_year_to_s3(year, records):

    key = (
        f"raw/boston-311/"
        f"{year}/rodent_activity.json"
    )

    body = json.dumps(
        records,
        ensure_ascii=False
    ).encode("utf-8")

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=body,
        ContentType="application/json"
    )

    print(
        f"Uploaded {len(records):,} records "
        f"to s3://{S3_BUCKET}/{key}"
    )


# -----------------------------------------
# STEP 5: GEOJSON HELPERS
# -----------------------------------------

def to_float(value):

    try:
        return float(value)

    except (TypeError, ValueError):
        return None


def create_geojson(records):

    features = []

    for record in records:

        latitude = to_float(
            record.get("latitude")
        )

        longitude = to_float(
            record.get("longitude")
        )


        if latitude is None or longitude is None:
            continue


        if not (
            42 <= latitude <= 43
            and
            -72 <= longitude <= -70
        ):
            continue


        properties = {
            key: value
            for key, value in record.items()
            if key not in {
                "latitude",
                "longitude"
            }
        }


        feature = {
            "type": "Feature",

            "geometry": {
                "type": "Point",

                # GeoJSON uses [longitude, latitude]
                "coordinates": [
                    longitude,
                    latitude
                ]
            },

            "properties": properties
        }


        features.append(feature)


    return {
        "type": "FeatureCollection",
        "features": features
    }


# -----------------------------------------
# STEP 6: INGEST 2025 + 2026
# -----------------------------------------

all_rodent_records = []


for year in YEARS_TO_INGEST:

    resource_id = year_resources[year]["id"]

    print(
        f"\nPulling {year}..."
    )


    yearly_records = get_rodent_reports(
        year,
        resource_id
    )


    save_year_to_s3(
        year,
        yearly_records
    )


    all_rodent_records.extend(
        yearly_records
    )


# -----------------------------------------
# STEP 7: CREATE COMBINED GEOJSON
# -----------------------------------------

geojson = create_geojson(
    all_rodent_records
)


print(
    "\nTotal rodent records:",
    f"{len(all_rodent_records):,}"
)

print(
    "Mappable rodent records:",
    f"{len(geojson['features']):,}"
)


# -----------------------------------------
# STEP 8: SAVE GEOJSON LOCALLY
# -----------------------------------------

with open(
    "rats.geojson",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        geojson,
        file,
        ensure_ascii=False
    )


print(
    "Wrote local rats.geojson"
)


# -----------------------------------------
# STEP 9: UPLOAD GEOJSON TO S3
# -----------------------------------------

serving_key = "serving/rats.geojson"

s3.put_object(
    Bucket=S3_BUCKET,
    Key=serving_key,

    Body=json.dumps(
        geojson,
        ensure_ascii=False
    ).encode("utf-8"),

    ContentType="application/geo+json"
)


print(
    f"Uploaded map dataset to "
    f"s3://{S3_BUCKET}/{serving_key}"
)