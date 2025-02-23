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
    r["Price/HCF"] = r["Consumption (HCF)"]!=0 ? r["Water&Sewer Charges"] / r["Consumption (HCF)"] : 0;
    r["Price/m3"] = r["Consumption (m3)"] !=0 ? r["Water&Sewer Charges"] / r["Consumption (m3)"] : 0;
    return r
  }).filter(d => d["Borough"] !== "FHA" && d["Borough"] !== "NON DEVELOPMENT FACILITY");

  const nyc_boroughs = new Set(ny.map(d => d["Borough"]))

  // #endregion

  // #region Slider

  const minDate = d3.min(ny, d => d["Revenue Month"]);
  const maxDate = d3.max(ny, d => d["Revenue Month"]);

  let ny_filtered = ny.slice();

  const BoroughsSelected = nyc_boroughs;

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

    ny_filtered = ny.filter(d => d["Revenue Month"] >= minDateValue && d["Revenue Month"] <= maxDateValue && BoroughsSelected.has(d["Borough"]));
    console.log('timeframe :',minDateValue, maxDateValue);
    console.log('ny filtered length :',ny_filtered.length);
    updateScorecards();
    updateLineCharts();
    treemap(800,285);
  }

  // Call filterData whenever the slider values change
  dateSlider.noUiSlider.on('change', filterData);

  // #endregion

  const colorScale = d3.scaleOrdinal()
    .domain([...new Set(ny_raw.map(d => d["Borough"]))])
    .range(["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#A8DADC", "#457B9D", "#1D3557"]);

  // #region Column Unit Selection

  const consumptionSelect = document.getElementById('consumption-select');
  let consumption = consumptionSelect.value;

  volume_unit = (consumptionSelect.value == "Consumption (m3)") ? "m3" : "HCF";

  consumptionSelect.addEventListener('change', function() {
    consumption = this.value;
    console.log(`Selected consumption unit: ${consumption}`);
    volume_unit = (consumptionSelect.value == "Consumption (m3)") ? "m3" : "HCF";
    update_metric_column();
    updateScorecards();
    updateLineCharts();
    treemap(800, 285);
  });

  // #endregion

  // #region Map

  d3.json("new-york-city-boroughs.geojson").then(Boroughs => {
      drawMap(Boroughs);
  });

  function drawMap(Boroughs) {
    
    const width = 475; 
    const height = 400;
    
    let projection = d3.geoAlbersUsa().fitSize([width, height], Boroughs);
    
    const svgMap = d3.select("#NYCMap").append("svg")
        .attr("viewBox", [0, 0, width, height]);

    var tooltip = d3.select('body').append('div')
        .attr("class", "svg-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("border-radius", "2px")
        .style("padding", "0.5em");

    var g = svgMap.append("g");

    var path = d3.geoPath().projection(projection);

    const color = colorScale;

    g.selectAll("path")
        .data(Boroughs.features)
        .join("path")
        .attr("d", path)
        .style("stroke", "white")
        .style("fill", d => color(d.properties.name))
        .attr("data-selected", "true")
        .on('mouseover', function(e, d) {
            tooltip.style("visibility", "visible");

            let isSelected = d3.select(this).attr("data-selected") === "true";
            if (isSelected) {
              tooltip.html("<strong>Borough:</strong> " + d.properties.name + "<br>" +
                "<strong>Water Consumption:</strong> " + d3.sum(ny_filtered.filter(e => e["Borough"] === d.properties.name), d => d[consumptionSelect.value]).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " " + volume_unit + "<br>" +
                "<strong>Water Charges:</strong> " + d3.sum(ny_filtered.filter(e => e["Borough"] === d.properties.name), d => d["Water&Sewer Charges"]).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " $"); 
            }
            else {tooltip.html("<strong>Borough:</strong> " + d.properties.name)}
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
              BoroughsSelected.delete(d.properties.name);
            } else {
              BoroughsSelected.add(d.properties.name);
            }
            d3.select(this).attr("data-selected", isSelected ? "false" : "true")
                          .style("fill", isSelected ? "gray" : color(d.properties.name));
            console.log("Boroughs selected:", BoroughsSelected);
            updateBoroughs();
        });

      function updateBoroughs() {
        filterData();
        console.log('BoroughsSelected :',BoroughsSelected);
        console.log('ny filtered lengthhhh :',ny_filtered.length);
        updateScorecards();
        updateLineCharts();
      };

    const legendGroup = svgMap.append("g")
    .attr("transform", `translate(${20}, ${20})`);
  
    legendGroup.selectAll("g")
      .data(BoroughsSelected)
      .join("g")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`) // 20px d'espacement vertical
      .each(function(d) {
        // Ajouter le rectangle de couleur
        d3.select(this).append("rect")
          .attr("width", 7)
          .attr("height", 7)
          .attr("fill", color(d));
        
        // Ajouter le texte associé
        d3.select(this).append("text")
          .attr("x", 15)
          .attr("y", 7)
          .attr("fill", "currentColor")
          .style("font-size", "12px")
          .text(d);
      });
}

  // #endregion

  // #region Scorecards

  function updateScorecards() {
    let total_consumption = d3.sum(ny_filtered, d => d[consumptionSelect.value]);
    let total_waterCharges = d3.sum(ny_filtered, d => d["Water&Sewer Charges"]);
    let pricePerUnit = total_waterCharges/total_consumption;
    
    document.getElementById("water-consumption").innerHTML = `💧 Consumption <br> ${total_consumption.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${volume_unit}`;
    document.getElementById("total-price").innerHTML = `💰 Total Charges <br> $${total_waterCharges.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    document.getElementById("price-per-unit").innerHTML = `📏 Price/${volume_unit} <br> $${pricePerUnit.toFixed(2)}`;
  }

  updateScorecards();

  // #endregion

  // #region LineChart

  function lineChart (dataset, x_value, y_value, color_value, div_id, width, height, legend = true, y_unit)
  {
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };

    const legendRectWidth = 10
    const legendRectHeight = 10
    const legendXPosition = width - margin.right - 100
    const legendVerticalPadding = 10
    const legendHorizontalPadding = 15
    const yAxisTextVerticalPadding = 45
    const xAxisTextVerticalPadding = 20
    const axisTextHorizontalPadding = 0

    const color = colorScale;

    d3.select(`#${div_id}`).select("svg").remove();

    const svgLineChart = d3.select(`#${div_id}`).append("svg")
      .attr("viewBox", [0, 0, width, height]);

    //We filter outliers
    
    let threshold = d3.quantile(dataset.map(d => d[y_value]), 0.9999);
    console.log('threshold :',threshold);

    let data = dataset.filter(d => d[y_value] <= threshold)
    console.log('data :',data);

    const scaleX = d3.scaleUtc()
      .domain(d3.extent(data, d => d[x_value]))
      .range([margin.left, width - margin.right]);
    
    const scaleY = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[y_value])])
      .range([height - margin.bottom, margin.top]);

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("visibility", "hidden")
      .style("font-size", "12px");

    svgLineChart.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => scaleX(d[x_value]))
      .attr("cy", (d, i) => scaleY(d[y_value]))
      .attr("r", 3)
      .style("fill", d => color(d[color_value]))
      .on("mouseover", function(event, d) {
        tooltip.style("visibility", "visible")
          .html(`${x_value}: ${d3.timeFormat("%B %Y")(d[x_value])}<br>${y_value}: ${d[y_value].toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${y_unit}`);
        d3.select(this).attr("r", 8);
      })
      .on("mousemove", function(event) {
        tooltip.style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function() {
        tooltip.style("visibility", "hidden");
        d3.select(this).attr("r", 3);
      });

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

    svgLineChart.append("text")
        .attr("x", width / 2)
        .attr("y", 1.5*margin.top)
        .attr("text-anchor", "middle")
        .attr("font-size", "15px")
        .attr("font-weight", "bold")
        .text("Price per volume unit over time");

    if (legend)
      {
        createLegend(svgLineChart, legendXPosition, colors_values, color, {
      width,
      margin,
      rectWidth: legendRectWidth,
      rectHeight: legendRectHeight,
      verticalPadding: legendVerticalPadding,
      horizontalPadding: legendHorizontalPadding,
    });
  }

    svgLineChart.append("text")
      .attr("x", 100)
      .attr("y", margin.top + yAxisTextVerticalPadding + xAxisTextVerticalPadding)
      .attr("transform", `rotate(-90, ${margin.left - axisTextHorizontalPadding}, ${margin.top + yAxisTextVerticalPadding})`)
      .text(y_value)
      .attr("text-anchor", "end")
      .style("font-size", "12px");

    svgLineChart.append("text")
      .attr("x", width - margin.right - axisTextHorizontalPadding)
      .attr("y", height)
      .text(x_value)
      .attr("text-anchor", "end")
      .style("font-size", "12px");
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

  //#endregion

  // #region Columt Unit Selection

  const metricSelect = document.getElementById('MetricChoice');
  let metric = document.querySelector('input[name="option"]:checked').value;

  function update_metric_column() {
    metric_column = (document.querySelector('input[name="option"]:checked').value == "Consumption") ? consumptionSelect.value : "Water&Sewer Charges";
  }
  update_metric_column();

  document.querySelectorAll('.MetricChoice input[name="option"]').forEach(radio => {
    radio.addEventListener('change', function() {
      metric = this.value;
      metric_column = (metric == "Consumption") ? consumptionSelect.value : "Water&Sewer Charges";
      treemap(800, 285);
      updateLineCharts();
    });
  });

  // #endregion

  // #region TreeMap

  function treemap (w,h) 
  {
    const data_tree = { name: "Root", children: [] };
    const boroughColors = colorScale;
  
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
        addToHierarchy(d["Borough"], d["Location"], d[metric_column]);
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
      .attr("viewBox", [0, 0, w, h + 20]);

    // Ajouter un titre
    svg.append("text")
        .attr("x", w / 2)
        .attr("y", 12)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(`${metric_column === "Water&Sewer Charges" ? "Charges" : "Consumption"} repartition by boulevard`);

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
  .attr("y", (d) => d.y0 + 20)
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
  .attr("y", (d) => d.y0 + 20)
  .attr("width", (d) => d.x1 - d.x0)
  .attr("height", (d) => d.y1 - d.y0)
  .attr("stroke", "white") // Bordure blanche pour les Locations
  .attr("stroke-width", 2)
  .attr("fill", (d) => boroughColors(d.parent.data.name)) // Même couleur que le Borough
  .on("mouseover", function(event, d) { // Afficher le tooltip et surbrillance
    tooltip.style("visibility", "visible")
      .html(`<strong>Borough :</strong> ${d.parent.data.name} <br>
             <strong>Rue :</strong> ${d.data.name} <br>
             <strong>${metric_column === "Water&Sewer Charges" ? "Charges" : "Consumption"} :</strong> ${d.value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${metric_column === "Water&Sewer Charges" ? "$" : volume_unit}`)
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
  .attr("y", (d) => d.y0 + 35)
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

  if (bbox.width > boxWidth - 10 || bbox.height > boxHeight) {
    textElement.remove(); // Supprime le texte si trop grand
  }
});
  };

  treemap(800, 285);
  console.log('metric', metric_column);
  
  // #endregion

  // #region Bar Chart

  function barchart(w, h, data, div_id) 
  {
    // Dimensions du graphique
    const width = w, height = h;
    const margin = { top: 40, right: 80, bottom: 25, left: 60 }; // Augmentation du right pour 2ème axe Y
  
    // Regrouper les données par Borough et calculer la somme de consommation et prix total
    const groupedData = d3.rollups(
      data,
      v => ({
        totalConsumption: d3.sum(v, d => d[consumptionSelect.value]),
        totalCharges: d3.sum(v, d => d["Water&Sewer Charges"])
      }),
      d => d["Borough"]
    );
  
    // Transformer les données en tableau structuré et ajouter PrixParVolume
    const formattedData = groupedData.map(([borough, values]) => ({
      borough,
      totalConsumption: values.totalConsumption,
      totalCharges: values.totalCharges,
      avgPricePerVolume: values.totalConsumption > 0 ? values.totalCharges / values.totalConsumption : 0
    }));
  
    // Définir les groupes de valeurs
    const subgroups = ["totalConsumption", "totalCharges"];
  
    // Définir les échelles
    const x = d3.scaleBand()
        .domain(formattedData.map(d => d.borough))
        .range([margin.left, width - margin.right])
        .padding(0.2);
  
    const xSubgroup = d3.scaleBand()
      .domain(subgroups)
      .range([0, x.bandwidth()])
      .paddingInner(0.1) // Ajuster la valeur pour contrôler l'espace entre les barres
      .paddingOuter(0.3); // Ajuster la valeur pour contrôler l'espace entre les groupes de barres
  
    // Échelle Y pour la consommation
    const yLeft = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.totalConsumption)])
        .nice()
        .range([height - margin.bottom, margin.top]);
  
    // Échelle Y pour le prix de l'eau au m³
    const yRight = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.totalCharges)])
        .nice()
        .range([height - margin.bottom, margin.top]);
  
    // Définir les couleurs pour chaque métrique
    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range(["#1B263B", "#A67C52"]); // Bleu pour consommation, orange pour prix/m³

    d3.select(`#${div_id}`).select("svg").remove();
  
    // Créer le conteneur SVG
    const svg = d3.select(`#${div_id}`).append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
  
    // Ajouter les barres groupées
    svg.append("g")
      .selectAll("g")
      .data(formattedData)
      .join("g")
        .attr("transform", d => `translate(${x(d.borough)},0)`)
      .selectAll("rect")
      .data(d => [
          { key: "totalConsumption", value: d.totalConsumption, yScale: yLeft },
          { key: "totalCharges", value: d.totalCharges, yScale: yRight }
      ])
      .join("rect")
        .attr("x", d => xSubgroup(d.key))
        .attr("y", d => d.yScale(d.value))
        .attr("height", d => d.yScale(0) - d.yScale(d.value))
        .attr("width", xSubgroup.bandwidth())
        .attr("fill", d => color(d.key))
      .append("title")
        .text(d => `${d.key === "totalConsumption" ? `Consumption (${volume_unit})` : "Charges ($)"}: ${d.value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`);
  
    // Ajouter l'axe X
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("text-anchor", "middle");
  
    // Ajouter l'axe Y gauche (Consommation)
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yLeft))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", -margin.left)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .text(`Consumption (${volume_unit})`));
  
    // Ajouter l'axe Y droit (Prix/m³)
    svg.append("g")
        .attr("transform", `translate(${width - margin.right},0)`)
        .call(d3.axisRight(yRight))
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", 0)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .text("Charges ($)"));
  
    // Ajouter une légende
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 225}, ${margin.top})`)
        .selectAll("g")
        .data(subgroups)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);
  
    legend.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => color(d));
  
    legend.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .attr("fill", "currentColor")
        .style("font-size", "12px")
        .text(d => d === "totalConsumption" ? `Consumption (${volume_unit})` : "Charges ($)");
  
    // Ajouter un titre
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Water consumption & charges per borough");

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

    // Ajouter les barres groupées avec les tooltips
    svg.append("g")
      .selectAll("g")
      .data(formattedData)
      .join("g")
      .attr("transform", d => `translate(${x(d.borough)},0)`)
      .selectAll("rect")
      .data(d => [
        { key: "totalConsumption", value: d.totalConsumption, yScale: yLeft },
        { key: "totalCharges", value: d.totalCharges, yScale: yRight }
      ])
      .join("rect")
      .attr("x", d => xSubgroup(d.key))
      .attr("y", d => d.yScale(d.value))
      .attr("height", d => d.yScale(0) - d.yScale(d.value))
      .attr("width", xSubgroup.bandwidth())
      .attr("fill", d => color(d.key))
      .on("mouseover", function(event, d) {
        tooltip.style("visibility", "visible")
        .html(`${d.key === "totalConsumption" ? `Consumption` : "Charges"}: ${d.value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${d.key === "totalConsumption" ? `${volume_unit}` : "$"}`);
        d3.select(this).attr("stroke", "black").attr("stroke-width", 2)
        .attr("fill", d3.color(color(d.key)).darker(0.8));
      })
      .on("mousemove", function(event) {
        tooltip.style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function() {
        tooltip.style("visibility", "hidden");
        d3.select(this).attr("stroke", "none")
        .attr("fill", color(d3.select(this).datum().key));
      });
  }
  // #endregion

  // #region Area Chart

  function StackedAreaChart(dataset, y_value, width = 1200, height = 350, div_id) {

    const margin = {top: 10, right: 10, bottom: 80, left: 50 };

    let threshold = d3.quantile(dataset.map(d => d[y_value]), 0.9999);

    let data = dataset.filter(d => d[y_value] <= threshold)
  
  // Filtrer le dataset pour supprimer les lignes où "Consumption (HCF)" ou "Water&Sewer Charges" sont nuls ou égaux à 0
  const filteredData = data.filter(d =>
    d["Consumption (HCF)"] != null &&
    d["Water&Sewer Charges"] != null &&
    d["Consumption (HCF)"] !== 0 &&
    d["Water&Sewer Charges"] !== 0
  );
  
  // Regrouper les données par "Revenue Month" et "Borough" et calculer la moyenne
  const groupedData = d3.rollup(
    filteredData,
    v => d3.sum(v, d => d[y_value]),
    d => d["Revenue Month"],
    d => d["Borough"]
  );
  
  
    // Transformer les données groupées en tableau structuré
    const formattedData = Array.from(groupedData, ([date, values]) => ({
      date,
      boroughs: Object.fromEntries(values)
    }));
  
  
    formattedData.sort((a, b) => d3.ascending(a.date, b.date));
  
    // Créer les séries empilées par borough
    const series = d3.stack()
      .keys(BoroughsSelected)
      .value((d, key) => d.boroughs[key] || 0)(formattedData);
  
    // Définir l'échelle X (pour les dates)
    const x = d3.scaleUtc()
      .domain(d3.extent(formattedData, d => d.date))
      .range([margin.left, width - margin.right]);
  
    // Définir l'échelle Y
    const y = d3.scaleLinear()
      .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
      .nice()
      .range([height - margin.bottom, margin.top]);
  
    // Définir l'échelle de couleur pour les boroughs
    const color = colorScale;
  
    // Définir la zone empilée
    const area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));
  
      d3.select(`#${div_id}`).select("svg").remove();
  
      // Créer le conteneur SVG
      const svg = d3.select(`#${div_id}`).append("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", [0, 0, width, height])
          .attr("style", "max-width: 100%; height: auto;");
  
    // Ajouter l'axe Y
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line")
      .clone().attr("x2", width - margin.left - margin.right)
      .attr("stroke-opacity", 0.05))
      .call(g => g.append("text")
      .attr("x", 10)
      .attr("y", 10)
      .attr("fill", "currentColor")
      .attr("text-anchor", "start")
      .style("font-size", "14px")
      .text(y_value));
  
    // Ajouter les zones empilées
    svg.append("g")
      .selectAll("path")
      .data(series)
      .join("path")
        .attr("fill", d => color(d.key))
        .attr("d", area)
      .append("title")
        .text(d => d.key);
  
    // Ajouter l'axe X
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

    // Ajouter un titre
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .text(`${y_value === "Water&Sewer Charges" ? "Charges" : "Consumption"} monthly trend`);

    // const legendGroup = svg.append("g")
    //   .attr("transform", `translate(${width - margin.left - 100}, ${margin.top})`);
  
    // legendGroup.selectAll("g")
    //   .data(BoroughsSelected)
    //   .join("g")
    //   .attr("transform", (d, i) => `translate(0, ${i * 20})`) // 20px d'espacement vertical
    //   .each(function(d) {
    //     // Ajouter le rectangle de couleur
    //     d3.select(this).append("rect")
    //       .attr("width", 7)
    //       .attr("height", 7)
    //       .attr("fill", color(d));
        
    //     // Ajouter le texte associé
    //     d3.select(this).append("text")
    //       .attr("x", 15)
    //       .attr("y", 7)
    //       .attr("fill", "currentColor")
    //       .style("font-size", "12px")
    //       .text(d);
    //   });

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

    // Ajouter les zones empilées avec les tooltips
    svg.append("g")
      .selectAll("path")
      .data(series)
      .join("path")
        .attr("fill", d => color(d.key))
        .attr("d", area)
        .on("mouseover", function(event, d) {
          tooltip.style("visibility", "visible")
            .html(`<strong>Borough:</strong> ${d.key}` );
          d3.select(this).attr("fill", d3.color(color(d.key)).darker(0.8));
        })
        .on("mousemove", function(event) {
          tooltip.style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function(event, d) {
          tooltip.style("visibility", "hidden");
          d3.select(this).attr("fill", color(d.key));
        });
  }
  

  // #endregion

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
      v => d3.sum(v, v => volume_unit === "HCF" ? v["Price/HCF"] : v["Price/m3"]),
      d => d["Borough"],
      d => d["Revenue Month"])]
  
    let ny_pricevolume_by_borough = [];
  
    ny_pricevolume_by_borough_map.forEach(([borough, dataMap]) => {
      dataMap.forEach((pricevolume, date) => {
            ny_pricevolume_by_borough.push({
              Borough: borough,
              "Revenue Month": date, 
              [`Price / ${volume_unit}`]: pricevolume
            });
      });
    });
  
    ny_consumption_by_borough.sort((d1,d2) => d1["Revenue Month"] - d2["Revenue Month"])
    ny_charges_by_borough.sort((d1,d2) => d1["Revenue Month"] - d2["Revenue Month"])
    ny_pricevolume_by_borough.sort((d1,d2) => d1["Revenue Month"] - d2["Revenue Month"]);
      
    (document.querySelector('input[name="option"]:checked').value == "Consumption") ? 
      //lineChart(ny_consumption_by_borough, "Revenue Month", "Consumption", "Borough", "areachart-container", 1200, 350, legend=true, metric_column === "Water&Sewer Charges" ? "$" : volume_unit) :
      //lineChart(ny_charges_by_borough, "Revenue Month", "Charges", "Borough", "areachart-container", 1200, 350, legend=true, metric_column === "Water&Sewer Charges" ? "$" : volume_unit);
      (StackedAreaChart(ny_filtered, consumptionSelect.value, 1200, 450, "areachart-container")) :
      StackedAreaChart(ny_filtered, "Water&Sewer Charges", 1200, 450, "areachart-container");
    //lineChart(ny_charges_by_borough, "Revenue Month", "Charges", "Borough", "LineChart2", 1200, 400);


    console.log('ny_pricevolume_by_borough :',ny_pricevolume_by_borough);
    lineChart(ny_pricevolume_by_borough, "Revenue Month", [`Price / ${volume_unit}`], "Borough", "LineChart2", 1200, 225, legend = false, `$/${volume_unit}`);
    
    barchart(1200, 200, ny_filtered, "LineChart1");
    }
});

// Get the modal
var modal = document.getElementById("myModal");

// Get the link that opens the modal
var link = document.getElementById("info-link");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks the link, open the modal 
link.onclick = function() {
    modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
    modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}