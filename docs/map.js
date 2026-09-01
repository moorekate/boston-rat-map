import * as maplibregl from "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs";

const RAT_DATA_URL =
  "https://kam-bos-311-rats.s3.us-east-2.amazonaws.com/serving/rats.geojson";


// -----------------------------------------
// BOSTON SEARCH BOUNDS
// -----------------------------------------

const BOSTON_VIEWBOX =
  "-71.1912,42.3969,-70.9860,42.2279";


let searchMarker = null;


// -----------------------------------------
// CREATE MAP
// -----------------------------------------

const map = new maplibregl.Map({
  container: "map",

  style:
    "https://tiles.openfreemap.org/styles/liberty",

  center: [
    -71.0589,
    42.3601
  ],

  zoom: 11
});


map.addControl(
  new maplibregl.NavigationControl(),
  "top-right"
);


// -----------------------------------------
// LOAD RAT DATA
// -----------------------------------------

map.on("load", () => {

  map.addSource("rats", {
    type: "geojson",

    data: RAT_DATA_URL,

    cluster: true,

    clusterMaxZoom: 14,

    clusterRadius: 50
  });


  // ---------------------------------------
  // CLUSTER CIRCLES
  // ---------------------------------------

  map.addLayer({
    id: "rat-clusters",

    type: "circle",

    source: "rats",

    filter: [
      "has",
      "point_count"
    ],

    paint: {

      "circle-radius": [
        "step",

        ["get", "point_count"],

        16,

        25, 20,

        100, 26,

        500, 34
      ],

      "circle-color":
        "#ffffff",

      "circle-opacity":
        0.9,

      "circle-stroke-color":
        "#000000",

      "circle-stroke-width":
        2
    }
  });


  // ---------------------------------------
  // NUMBER INSIDE EACH CLUSTER
  // ---------------------------------------

  map.addLayer({
    id: "rat-cluster-count",

    type: "symbol",

    source: "rats",

    filter: [
      "has",
      "point_count"
    ],

    layout: {

      "text-field": [
        "get",
        "point_count_abbreviated"
      ],

      "text-size": 12,

      "text-allow-overlap":
        true
    },

    paint: {

      "text-color":
        "#000000"
    }
  });


  // ---------------------------------------
  // INDIVIDUAL RAT REPORTS
  // ---------------------------------------

  map.addLayer({
    id: "rat-points",

    type: "circle",

    source: "rats",

    filter: [
      "!",
      ["has", "point_count"]
    ],

    paint: {

      "circle-radius": [
        "interpolate",

        ["linear"],

        ["zoom"],

        11, 3,

        14, 5,

        17, 8
      ],

      "circle-color":
        "#ffffff",

      "circle-stroke-color":
        "#000000",

      "circle-stroke-width":
        1
    }
  });


  // ---------------------------------------
  // CLICK CLUSTER TO ZOOM
  // ---------------------------------------

  map.on(
    "click",
    "rat-clusters",
    async (event) => {

      const features =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              "rat-clusters"
            ]
          }
        );


      if (!features.length) {
        return;
      }


      const cluster =
        features[0];


      const clusterId =
        cluster.properties.cluster_id;


      const source =
        map.getSource("rats");


      const zoom =
        await source.getClusterExpansionZoom(
          clusterId
        );


      map.easeTo({
        center:
          cluster.geometry.coordinates,

        zoom: zoom
      });

    }
  );


  // ---------------------------------------
  // CLICK INDIVIDUAL RAT LOCATION
  // ---------------------------------------

  map.on(
    "click",
    "rat-points",
    (event) => {

      const clickedFeatures =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              "rat-points"
            ]
          }
        );


      if (!clickedFeatures.length) {
        return;
      }


      const coordinates =
        clickedFeatures[0]
          .geometry
          .coordinates;


      const reports =
        clickedFeatures.map(
          feature =>
            feature.properties
        );


      const reportsHtml =
        reports
          .map(
            (props, index) => {

              return `
                <div style="margin-bottom: 10px;">

                  <strong>
                    Rodent Activity
                    ${
                      reports.length > 1
                        ? `#${index + 1}`
                        : ""
                    }
                  </strong>

                  <br>

                  Year:
                  ${
                    props.source_year ??
                    "Unknown"
                  }

                  <br>

                  Opened:
                  ${
                    props.open_dt ??
                    "Unknown"
                  }

                  <br>

                  Status:
                  ${
                    props.case_status ??
                    "Unknown"
                  }

                  <br>

                  Location:
                  ${
                    props.location ??
                    "Unknown"
                  }

                  <br>

                  Neighborhood:
                  ${
                    props.neighborhood ??
                    "Unknown"
                  }

                </div>
              `;

            }
          )
          .join("<hr>");


      new maplibregl.Popup({
        maxWidth:
          "350px"
      })

        .setLngLat(
          coordinates
        )

        .setHTML(`
          <strong>
            ${reports.length}
            report${
              reports.length === 1
                ? ""
                : "s"
            }
            at this location
          </strong>

          <hr>

          ${reportsHtml}
        `)

        .addTo(map);

    }
  );


  // ---------------------------------------
  // POINTER CURSOR
  // ---------------------------------------

  map.on(
    "mouseenter",
    "rat-points",
    () => {

      map.getCanvas()
        .style
        .cursor = "pointer";

    }
  );


  map.on(
    "mouseleave",
    "rat-points",
    () => {

      map.getCanvas()
        .style
        .cursor = "";

    }
  );


  map.on(
    "mouseenter",
    "rat-clusters",
    () => {

      map.getCanvas()
        .style
        .cursor = "pointer";

    }
  );


  map.on(
    "mouseleave",
    "rat-clusters",
    () => {

      map.getCanvas()
        .style
        .cursor = "";

    }
  );

});


// -----------------------------------------
// ADDRESS SEARCH
// -----------------------------------------

const searchForm =
  document.getElementById(
    "address-search-form"
  );


const searchInput =
  document.getElementById(
    "address-search"
  );


const searchMessage =
  document.getElementById(
    "search-message"
  );


searchForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const address =
      searchInput.value.trim();


    if (!address) {
      return;
    }


    searchMessage.textContent =
      "Searching...";


    const url =
      new URL(
        "https://nominatim.openstreetmap.org/search"
      );


    url.searchParams.set(
      "q",
      address
    );


    url.searchParams.set(
      "format",
      "jsonv2"
    );


    url.searchParams.set(
      "limit",
      "1"
    );


    url.searchParams.set(
      "countrycodes",
      "us"
    );


    url.searchParams.set(
      "viewbox",
      BOSTON_VIEWBOX
    );


    url.searchParams.set(
      "bounded",
      "1"
    );


    try {

      const response =
        await fetch(url);


      if (!response.ok) {

        throw new Error(
          `Geocoder returned ${response.status}`
        );

      }


      const results =
        await response.json();


      if (!results.length) {

        searchMessage.textContent =
          "No Boston address found.";

        return;

      }


      const result =
        results[0];


      const latitude =
        Number(result.lat);


      const longitude =
        Number(result.lon);


      // Remove previous marker
      if (searchMarker) {

        searchMarker.remove();

      }


      // Add marker at searched address
      searchMarker =
        new maplibregl.Marker()

          .setLngLat([
            longitude,
            latitude
          ])

          .addTo(map);


      // Zoom to searched address
      map.flyTo({

        center: [
          longitude,
          latitude
        ],

        zoom: 17,

        essential: true

      });


      searchMessage.textContent =
        result.display_name;


    } catch (error) {

      console.error(error);

      searchMessage.textContent =
        "Address search failed.";

    }

  }
);