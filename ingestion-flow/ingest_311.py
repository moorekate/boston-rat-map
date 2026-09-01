import requests #https://requests.readthedocs.io/en/latest/user/quickstart/
import pprint # imports whole module

# In CKAN, a package = a dataset
# ckan.logic.action.get.[some_function] <=> Python module
# CKAN source code                    Public API
# ────────────────                    ──────────
# ckan.logic.action.get.package_show  → /api/3/action/package_show
# ckan.logic.action.get.package_list  → /api/3/action/package_list
# ckan.logic.action.get.resource_show → /api/3/action/resource_show

# url = "https://data.boston.gov/api/3/action/package_search" # package_search → q=
# once you have the exact source id, switch to package_show & use id to get the dataset (package) and its resources
url = "https://data.boston.gov/api/3/action/package_show" # package_show → id=
# url = "https://demo.ckan.org/api/3/action/package_search" # use https over http 
# ^^^ this is the DEMO CKAN instance for testing CKAN functionality, not the BOSTON instance!
# what params does /api/3/action/package_search accept? 
# see https://docs.ckan.org/en/2.9/api/?utm_source=chatgpt.com#ckan.logic.action.get.package_search

params = { # requests will URL-encode these and append them to the URL
    # "q": "311", # the dataset we want to retrieve
    "id": "8048697b-ad64-4bfc-b090-ee00169f2323",
    # in the Boston 311 package/dataset, every year is listed as an individual resource!
    "rows": 5
}

response = requests.get(
    url,
    params=params,
    timeout=30
)

# print(response.url)
print(response.status_code)
# checks whether the HTTP request was successful (200 OK) or not (404 Not Found, 500 Internal Server Error, etc.)

response.raise_for_status()

data = response.json() # Convert response to JSON
data["success"] # checks whether the CKAN API call was successful (True/False)

# datasets = data["result"]["results"]
# package_search --> result ( data["result"] )--> count, facets, results, search_facets, sort (data["result"]["results"] )
# package_search returns a dictionary of results 

dataset = data["result"] # package_show returns only one dataset, so we can just assign it to a variable called dataset

# print(type(datasets)) # what kind of Python object is this?
# print(len(datasets))

# print(datasets[0].keys()) # examining the fields of the first dataset in the list of datasets returned by package_search

# datasets[0] --> represents the first dataset in the list of datasets returned by package_search
# remember, datasets = [datasets = [ {dataset 1}, {dataset 2}, {dataset 3} ] where each is its own dictionary
# keys then returns the keys of the first dataset (dataset 1) dictionary (key:value pairs), which are the fields of the dataset
# for example, dataset 1 contains {"id": "...", "name": "...", "title": "...", "resources": [...], "metadata_created": "...", etc}
# .keys() returns an object that is a list of the keys in the dictionary --> ex. dict_keys(['name', 'age'])
# so this would return: dict_keys(['id', 'name', 'title', 'notes', 'organization', 'resources', 'metadata_created', etc.])

print(dataset.keys()) # examining the fields of the dataset returned by package_show

# for dataset in datasets:
#     print("TITLE:", dataset["title"])
#     print("NAME:", dataset["name"])
#     print("ID:", dataset["id"])

print("TITLE:", dataset["title"])
print("NAME:", dataset["name"])
print("ID:", dataset["id"])
# rest of code is norml after this point, as we invetsigate resources associated with the dataset

# now we want to investigate the "resources" field of the first dataset
# resources is a list of dictionaries, where each dictionary represents a resource associated with the dataset
# resources are the actual files/data sources associated with a dataset

resources = dataset["resources"] # within dataset, find the "resources" field
print(type(resources))
print(len(resources))
print(resources[0].keys()) # just examining the keys of the first resource in the list of resources for the first dataset

for resource in resources:
    print(resource["format"]) # i.e. which formats did we retrieve for a single dataset? (CSV, JSON, PDF, etc.)

# the DataStore = CKAN’s queryable tabular database layer
# some resources are stored in the DataStore, which allows for querying and filtering of tabular data
# some are not stored in the DataStore, which means they are just files that can be downloaded but not queried
# if Datastore active is false, then we have to ingest the data from the resource URL (i.e. download the file and parse it ourselves)
# if Datastore active is true, then we can query the resource using the DataStore API (i.e. we can use CKAN to query the data for us)
for resource in resources:
    print("Name:", resource.get("name"))
    print("Format:", resource.get("format")) 
    print("Datastore active:", resource.get("datastore_active"))
    print("ID:", resource.get("id")) # id of the resource (i.e. the unique identifier for the resource in CKAN)
    print("URL:", resource.get("url")) # url of the resource (i.e. where the file is located) on the CKAN instance
    print()
