import * as maplibregl from "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs";

const RAT_DATA_URL =
  "https://kam-bos-311-rats.s3.us-east-2.amazonaws.com/serving/rats.geojson";

const BOSTON_VIEWBOX =
  "-71.1912,42.3969,-70.9860,42.2279";

let searchMarker = null;


// -----------------------------------------
// CREATE MAP
// -----------------------------------------

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [-71.0589, 42.3601],
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

      "circle-color": "#ffffff",
      "circle-opacity": 0.9,
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 2
    }
  });


  // ---------------------------------------
  // CLUSTER COUNT
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
      "text-allow-overlap": true
    },

    paint: {
      "text-color": "#000000"
    }
  });


  // ---------------------------------------
  // INDIVIDUAL RAT POINTS
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

      "circle-color": "#ffffff",
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 1
    }
  });


  // ---------------------------------------
  // CLICK CLUSTER -> ZOOM
  // ---------------------------------------

  map.on(
    "click",
    "rat-clusters",
    async (event) => {

      const features =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: ["rat-clusters"]
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
            layers: ["rat-points"]
          }
        );


      if (!clickedFeatures.length) {
        return;
      }


      const coordinates =
        clickedFeatures[0]
          .geometry
          .coordinates;


      // -----------------------------------
      // GET REPORTS + SORT NEWEST -> OLDEST
      // -----------------------------------

      const reports =
        clickedFeatures
          .map(
            feature =>
              feature.properties
          )
          .sort(
            (a, b) => {

              const dateA =
                a.open_dt
                  ? new Date(
                      a.open_dt
                    ).getTime()
                  : 0;


              const dateB =
                b.open_dt
                  ? new Date(
                      b.open_dt
                    ).getTime()
                  : 0;


              return dateA - dateB;
            }
          );


      // -----------------------------------
      // DETERMINE AVAILABLE SCREEN SPACE
      // -----------------------------------

      const mapHeight =
        map.getContainer().clientHeight;

      const clickY =
        event.point.y;

      const spaceAbove =
        clickY;

      const spaceBelow =
        mapHeight - clickY;

      const padding =
        30;


      let popupAnchor;
      let availableHeight;


      if (spaceAbove >= spaceBelow) {

        popupAnchor =
          "bottom";

        availableHeight =
          Math.max(
            180,
            spaceAbove - padding
          );

      } else {

        popupAnchor =
          "top";

        availableHeight =
          Math.max(
            180,
            spaceBelow - padding
          );

      }


      // -----------------------------------
      // BUILD REPORT HTML
      // -----------------------------------

      const reportsHtml =
        reports
          .map(
            (props, index) => {

              return `
                <div class="rat-report">

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


      // -----------------------------------
      // CREATE POPUP
      // -----------------------------------

      const popup =
        new maplibregl.Popup({
          maxWidth: "360px",
          anchor: popupAnchor
        })

          .setLngLat(
            coordinates
          )

          .setHTML(`
            <div class="rat-popup">

              <div class="rat-popup-header">
                ${reports.length}
                report${
                  reports.length === 1
                    ? ""
                    : "s"
                }
                at this location
              </div>

              <div class="rat-popup-reports">
                ${reportsHtml}
              </div>

            </div>
          `)

          .addTo(map);


      // -----------------------------------
      // APPLY RESPONSIVE HEIGHT
      // -----------------------------------

      requestAnimationFrame(
        () => {

          const popupElement =
            popup.getElement();

          if (!popupElement) {
            return;
          }


          const popupContent =
            popupElement.querySelector(
              ".maplibregl-popup-content"
            );


          if (!popupContent) {
            return;
          }


          popupContent.style.maxHeight =
            `${availableHeight}px`;

          popupContent.style.overflowY =
            "auto";

        }
      );

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


      if (searchMarker) {
        searchMarker.remove();
      }


      searchMarker =
        new maplibregl.Marker()

          .setLngLat([
            longitude,
            latitude
          ])

          .addTo(map);


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