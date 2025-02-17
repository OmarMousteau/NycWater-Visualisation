d3.csv("NY.csv").then(ny_raw => {

  // #region DataPreprocessing
  
  const ny = ny_raw.map(d => {
    let r = {};
    r["Development Name"] = d["Development Name"];
    r["Borough"] = d["Borough"];
    r["Location"] = d["Location"];
    r["Revenue Month"] = d3.timeParse("%Y-%m")(d["Revenue Month"]);
    r["Consumption (HCF)"] = +d["Consumption (HCF)"];
    r["Consumption (m3)"] = 2.8317 * r["Consumption (HCF)"];
    r["Water&Sewer Charges"] = +d["Water&Sewer Charges"];
    r["Other Charges"] = +d["Other Charges"];
    r["Current Charges"] = +d["Current Charges"];
    r["Price/HCF"] = r["Water&Sewer Charges"] / r["Consumption (HCF)"];
    r["Price/m3"] = r["Water&Sewer Charges"] / r["Consumption (m3)"];
    return r
  })

  const nyc_boroughs = new Set(ny.map(d => d["Borough"]))

  // #endregion

  // #region Slider

  const minDate = d3.min(ny, d => d["Revenue Month"]);
  const maxDate = d3.max(ny, d => d["Revenue Month"]);

  let ny_filtered = ny.slice();

  const dateSlider = document.getElementById('date-slider');

  noUiSlider.create(dateSlider, {
    start: [minDate.getTime(), maxDate.getTime()],
    connect: true,
    range: {
      'min': minDate.getTime(),
      'max': maxDate.getTime()
    },
    step: 1000 * 60 * 60 * 24 * 30 // Approx. one month
  });

  dateSlider.noUiSlider.on('update', function (values, handle) {
    const minDateValue = new Date(+values[0]);
    const maxDateValue = new Date(+values[1]);
    d3.select("#date-display").text(`From ${d3.timeFormat("%B %Y")(minDateValue)} to ${d3.timeFormat("%B %Y")(maxDateValue)}`);
  });

  // Initial display
  const initialMinDateValue = new Date(+dateSlider.noUiSlider.get()[0]);
  const initialMaxDateValue = new Date(+dateSlider.noUiSlider.get()[1]);
  d3.select("#date-display").text(`From ${d3.timeFormat("%B %Y")(initialMinDateValue)} to ${d3.timeFormat("%B %Y")(initialMaxDateValue)}`);

  // Function to get the current slider values and filter the dataset
  function filterData() {
    const sliderValues = dateSlider.noUiSlider.get();
    const minDateValue = new Date(+sliderValues[0]);
    const maxDateValue = new Date(+sliderValues[1]);

    ny_filtered = ny.filter(d => d["Revenue Month"] >= minDateValue && d["Revenue Month"] <= maxDateValue);
    console.log('timeframe :',minDateValue, maxDateValue);
    console.log('ny filtered length :',ny_filtered.length);
    updateScorecards();
    updateLineCharts();
    treemap();
  }

  // Call filterData whenever the slider values change
  dateSlider.noUiSlider.on('change', filterData);

  // #endregion

  // #region Columt Unit Selection

  const consumptionSelect = document.getElementById('consumption-select');
  let consumption = consumptionSelect.value;

  volume_unit = (consumptionSelect.value == "Consumption (m3)") ? "m3" : "HCF";

  consumptionSelect.addEventListener('change', function() {
    consumption = this.value;
    console.log(`Selected consumption unit: ${consumption}`);
    volume_unit = (consumptionSelect.value == "Consumption (m3)") ? "m3" : "HCF";
    updateScorecards();
    updateLineCharts();
    treemap();
  });

  // #endregion

  // #region Map

  d3.json("new-york-city-boroughs.geojson").then(Boroughs => {
      drawMap(Boroughs);
  });

  function drawMap(Boroughs) {
    let BoroughsSelected = [];
    
    const width = 800; 
    const height = 675;
    
    let projection = d3.geoAlbersUsa().fitSize([width, height], Boroughs);
    
    const svgMap = d3.select("#NYCMap").append("svg")
        .attr("viewBox", [0, 0, width, height]);

    var tooltip = d3.select('body').append('div')
        .attr("class", "svg-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "#9ec9e1")
        .style("border-radius", "2px")
        .style("padding", "0.5em");

    var g = svgMap.append("g");

    var path = d3.geoPath().projection(projection);

    g.selectAll("path")
        .data(Boroughs.features)
        .join("path")
        .attr("d", path)
        .style("stroke", "white")
        .style("fill", "grey")
        .attr("data-selected", "false")
        .on('mouseover', function(e, d) {
            tooltip.style("visibility", "visible");
            tooltip.text("Borough : " + d.properties.name);
            d3.select(this).style("stroke", "black").style("stroke-width", "2px");
        })
        .on('mousemove', function(e, d) {
            tooltip.style("top", (e.pageY - 10) + "px")
                   .style("left", (e.pageX + 10) + "px");
        })
        .on('mouseout', function(e, d) {
            tooltip.style('visibility', 'hidden');
            d3.select(this).style("stroke", "white").style("stroke-width", "1px");
        })
        .on("click", function(e, d) {
            let isSelected = d3.select(this).attr("data-selected") === "true";
            if (isSelected) {
                BoroughsSelected = BoroughsSelected.filter(name => name !== d.properties.name);
            } else {
                BoroughsSelected.push(d.properties.name);
            }
            d3.select(this).attr("data-selected", isSelected ? "false" : "true")
                          .style("fill", isSelected ? "gray" : "#0b4b91");
            console.log("Boroughs selected:", BoroughsSelected);
            // updateBoroughs();
        });

      // function updateBoroughs() {
      //   ny_filtered = ny_filtered.filter(d => BoroughsSelected.includes(d["Borough"]));
      //   console.log('BoroughsSelected :',BoroughsSelected);
      //   console.log('ny filtered lengthhhh :',ny_filtered.length);
      //   updateScorecards();
      //   updateLineCharts();
      // };
}

  // #endregion

  // #region Scorecards

  function updateScorecards() {
    let total_consumption = d3.sum(ny_filtered, d => d[consumptionSelect.value]);
    let total_waterCharges = d3.sum(ny_filtered, d => d["Water&Sewer Charges"]);
    let pricePerUnit = total_waterCharges/total_consumption;
    let otherCharges = d3.sum(ny_filtered, d => d["Other Charges"]);
    
    document.getElementById("water-consumption").innerHTML = `💧 Consumption : ${total_consumption.toFixed(0)} ${volume_unit}`;
    document.getElementById("total-price").innerHTML = `💰 Total Charges : $${total_waterCharges.toFixed(2)}`;
    document.getElementById("price-per-unit").innerHTML = `📏 Price/${volume_unit} : $${pricePerUnit.toFixed(2)}`;
    document.getElementById("other-charges").innerHTML = `📌 Other charges : $${otherCharges.toFixed(2)}`;

    console.log('total_consumption :',total_consumption);
  }

  updateScorecards();

  // #endregion

  // #region LineChart

  function lineChart (dataset, x_value, y_value, color_value, div_id)
  {
    const width = 1200;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };

    const legendRectWidth = 10
    const legendRectHeight = 10
    const legendXPosition = width - margin.right - 100
    const legendVerticalPadding = 10
    const legendHorizontalPadding = 15
    const yAxisTextVerticalPadding = 45
    const xAxisTextVerticalPadding = 20
    const axisTextHorizontalPadding = 0

    const color = d3.scaleOrdinal(d3.schemeCategory10)

    d3.select(`#${div_id}`).select("svg").remove();

    const svgLineChart = d3.select(`#${div_id}`).append("svg")
      .attr("viewBox", [0, 0, width, height]);

    //We filter oulliers
    
    let threshold = d3.quantile(dataset.map(d => d[y_value]), 0.9999);
    console.log('threshold :',threshold);

    let data = dataset.filter(d => d[y_value] <= threshold)
    console.log('data :',data);

    const scaleX = d3.scaleUtc()
      //.domain([d3.max(data, d => d[x_value]), d3.max(data, d => d[x_value])])
      .domain(d3.extent(data, d => d[x_value]))
      .range([margin.left, width - margin.right]);
    
    const scaleY = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[y_value])])
      .range([height - margin.bottom, margin.top]);

    svgLineChart.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => scaleX(d[x_value]))
      .attr("cy", (d, i) => scaleY(d[y_value]))
      .attr("r", 2)
      .style("fill", d => color(d[color_value]))

    const grouped_data = d3.group(data, d => d[color_value]);

    const line = d3.line()
        .x(d => scaleX(d[x_value]))
        .y(d => scaleY(d[y_value]));

    svgLineChart.selectAll("path")
      .data(grouped_data)
      .enter()
      .append("path")
      .attr("d", d => line(d[1]))
      .attr("stroke", d => color(d[0]))
      .attr("fill", "none")

    const xAxis = createAxis(scaleX, d3.axisBottom, `translate(0, ${height - margin.bottom})`)  
    svgLineChart.append("g")
        .call(xAxis);

    const yAxis = createAxis(scaleY, d3.axisLeft, `translate(${margin.left}, 0)`)
    svgLineChart.append("g")
        .call(yAxis);

    const colors_values = new Set(data.map(d => d[color_value]))

    createLegend(svgLineChart, legendXPosition, colors_values, color, {
      width,
      margin,
      rectWidth: legendRectWidth,
      rectHeight: legendRectHeight,
      verticalPadding: legendVerticalPadding,
      horizontalPadding: legendHorizontalPadding,
    });

    svgLineChart.append("text")
      .attr("x", 100)
      .attr("y", margin.top + yAxisTextVerticalPadding + xAxisTextVerticalPadding)
      .attr("transform", `rotate(-90, ${margin.left - axisTextHorizontalPadding}, ${margin.top + yAxisTextVerticalPadding})`)
      .text(y_value)
      .attr("text-anchor", "end")
      .style("font-size", "13px");

    svgLineChart.append("text")
      .attr("x", width - margin.right - axisTextHorizontalPadding)
      .attr("y", height)
      .text(x_value)
      .attr("text-anchor", "end")
      .style("font-size", "13px");
  }

  function createAxis(scale, orientation, transform) {
    return g => g.attr("transform", transform).call(orientation(scale));
  }

  function createLegend(svg, x_position, data, color, config) {
    const legend = svg.selectAll(".legend")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(0, ${config.margin.top + i * (config.rectHeight + config.verticalPadding)})`);
  
    legend.append("rect")
      //.attr("x", config.width - config.margin.right - config.rectWidth)
      .attr("x", x_position)
      .attr("y", 0)
      .attr("width", config.rectWidth)
      .attr("height", config.rectHeight)
      .style("fill", d => color(d));
  
    legend.append("text")
      //.attr("x", config.width - config.margin.right - config.rectWidth - config.horizontalPadding)
      .attr("x", x_position - config.horizontalPadding)
      .attr("y", config.rectHeight / 2)
      .attr("dy", "0.35em")
      .text(d => d)
      .attr("text-anchor", "end");
  }

  updateLineCharts();

  function updateLineCharts() {

    let ny_consumption_by_borough_map = [...d3.rollup(ny_filtered,  
      v => d3.sum(v, v => v[consumptionSelect.value]),
      d => d["Borough"],
      d => d["Revenue Month"])]
  
    let ny_consumption_by_borough = [];
  
    ny_consumption_by_borough_map.forEach(([borough, dataMap]) => {
      dataMap.forEach((consumption, date) => {
          ny_consumption_by_borough.push({
              Borough: borough,
              "Revenue Month": date, 
              Consumption: consumption
          });
      });
    });
  
    let ny_charges_by_borough_map = [...d3.rollup(ny_filtered,  
      v => d3.sum(v, v => v["Water&Sewer Charges"]),
      d => d["Borough"],
      d => d["Revenue Month"])]
  
    let ny_charges_by_borough = [];
  
    ny_charges_by_borough_map.forEach(([borough, dataMap]) => {
      dataMap.forEach((charges, date) => {
          ny_charges_by_borough.push({
              Borough: borough,
              "Revenue Month": date, 
              Charges: charges
          });
      });
    });

    let ny_pricevolume_by_borough_map = [...d3.rollup(ny_filtered,  
      v => d3.sum(v, v => v["Price/HCF"]),
      d => d["Borough"],
      d => d["Revenue Month"])]
  
    let ny_pricevolume_by_borough = [];
  
    ny_pricevolume_by_borough_map.forEach(([borough, dataMap]) => {
      dataMap.forEach((pricevolume, date) => {
          ny_pricevolume_by_borough.push({
              Borough: borough,
              "Revenue Month": date, 
              PriceVolume: pricevolume
          });
      });
    });
  
    ny_consumption_by_borough.sort((d1,d2) => d1["Revenue Month"] - d2["Revenue Month"])
    ny_charges_by_borough.sort((d1,d2) => d1["Revenue Month"] - d2["Revenue Month"])
  
    console.log(ny_charges_by_borough)
    
    lineChart(ny_consumption_by_borough, "Revenue Month", "Consumption", "Borough", "LineChart1");
    lineChart(ny_charges_by_borough, "Revenue Month", "Charges", "Borough", "LineChart2");


    console.log('ny_pricevolume_by_borough_map :',ny_pricevolume_by_borough_map);
    lineChart(ny_pricevolume_by_borough_map, "Revenue Month", "Price/HCF", "Borough", "areachart-container");
    }


  //#endregion

  // #region TreeMap

  function treemap () 
  {
    const w = 800;
    const h = 400;

    const data_tree = { name: "Root", children: [] };
    const boroughColors = d3.scaleOrdinal(d3.schemeCategory10);
  
    {
      function addToHierarchy(borough, location, value) {
        let boroughNode = data_tree.children.find((b) => b.name === borough);
        if (!boroughNode) {
          boroughNode = { name: borough, children: [], borough: borough };
          data_tree.children.push(boroughNode);
        }
  
        let locationNode = boroughNode.children.find((l) => l.name === location);
        if (!locationNode) {
          locationNode = { name: location, value: 0, borough: borough };
          boroughNode.children.push(locationNode);
        }
  
        locationNode.value += value;
      }
  
      ny_filtered.forEach((d) => {
        addToHierarchy(d["Borough"], d["Location"], d["Water&Sewer Charges"]);
      });
    }
  
    const root = d3
      .hierarchy(data_tree)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);
  
    const treemap = d3.treemap().size([w, h]).paddingInner(2).paddingOuter(5);
  
    const treemap_data = treemap(root);

    d3.select(`#treemap-container`).select("svg").remove();

    const svg = d3.select(`#treemap-container`).append("svg")
      .attr("viewBox", [0, 0, w, h]);

    // Ajouter un div pour les tooltips (initialement caché)
  const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("background", "rgba(0, 0, 0, 0.8)")
  .style("color", "white")
  .style("padding", "8px")
  .style("border-radius", "4px")
  .style("visibility", "hidden")
  .style("font-size", "12px");

// Dessiner les rectangles des Boroughs avec une bordure noire
svg
  .selectAll(".borough")
  .data(treemap_data.children) // Sélectionne uniquement les Boroughs
  .enter()
  .append("rect")
  .attr("class", "borough")
  .attr("x", (d) => d.x0)
  .attr("y", (d) => d.y0)
  .attr("width", (d) => d.x1 - d.x0)
  .attr("height", (d) => d.y1 - d.y0)
  .attr("stroke", "black") // Bordure noire pour les Boroughs
  .attr("stroke-width", 3)
  .attr("fill", (d) => boroughColors(d.data.name));

// Dessiner les rectangles des Locations avec une bordure blanche et mise en surbrillance
svg
  .selectAll(".location")
  .data(treemap_data.leaves()) 
  .enter()
  .append("rect")
  .attr("class", "location")
  .attr("x", (d) => d.x0)
  .attr("y", (d) => d.y0)
  .attr("width", (d) => d.x1 - d.x0)
  .attr("height", (d) => d.y1 - d.y0)
  .attr("stroke", "white") // Bordure blanche pour les Locations
  .attr("stroke-width", 2)
  .attr("fill", (d) => boroughColors(d.parent.data.name)) // Même couleur que le Borough
  .on("mouseover", function(event, d) { // Afficher le tooltip et surbrillance
    tooltip.style("visibility", "visible")
      .html(`<strong>Borough :</strong> ${d.parent.data.name} <br>
             <strong>Rue :</strong> ${d.data.name} <br>
             <strong>Charges :</strong> $${d.value.toFixed(2)}`)
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY + 10}px`);
    
    d3.select(this)
      .attr("stroke", "white") // Bordure noire au survol
      .attr("stroke-width", 3)
      .attr("fill", d3.color(boroughColors(d.parent.data.name)).darker(0.8)); // Assombrir la couleur au survol
  })
  .on("mousemove", function(event) { // Suivre la souris
    tooltip.style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY + 10}px`);
  })
  .on("mouseout", function(d) { // Cacher le tooltip et enlever la surbrillance
    tooltip.style("visibility", "hidden");

    d3.select(this)
      .attr("stroke", "white") // Remet la bordure blanche
      .attr("stroke-width", 2)
      .attr("fill", boroughColors(d3.select(this).datum().parent.data.name)); // Rétablir la couleur normale
  });

// Ajouter les labels pour les Locations en évitant les débordements
const labels = svg
  .selectAll(".location-label")
  .data(treemap_data.leaves()) 
  .enter()
  .append("text")
  .attr("class", "location-label")
  .attr("x", (d) => d.x0 + 5)
  .attr("y", (d) => d.y0 + 15)
  .attr("fill", "white")
  .attr("font-size", "12px")
  .attr("font-weight", "bold")
  .text((d) => d.data.name);

// Vérifier si le texte dépasse sa case et le masquer si nécessaire
labels.each(function (d) {
  const textElement = d3.select(this);
  const bbox = textElement.node().getBBox();
  const boxWidth = d.x1 - d.x0;
  const boxHeight = d.y1 - d.y0;

  if (bbox.width > boxWidth - 30 || bbox.height > boxHeight - 30) {
    textElement.remove(); // Supprime le texte si trop grand
  }
});
  };

  treemap();
  
  // #endregion
});