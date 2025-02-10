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
    return r
  })

  const nyc_boroughs = new Set(ny.map(d => d["Borough"]))

  // #endregion

  // #region Slider

  const minDate = d3.min(ny, d => d["Revenue Month"]);
  const maxDate = d3.max(ny, d => d["Revenue Month"]);

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

    const filtered_ny = ny.filter(d => d["Revenue Month"] >= minDateValue && d["Revenue Month"] <= maxDateValue);
    console.log('timeframe :',minDateValue, maxDateValue);
    console.log('ny filtered length :',filtered_ny.length);
  }

  // Call filterData whenever the slider values change
  dateSlider.noUiSlider.on('change', filterData);

  // #endregion

  // #region Columt Unit Selection

  const consumptionSelect = document.getElementById('consumption-select');
  let consumption = consumptionSelect.value;

  consumptionSelect.addEventListener('change', function() {
    consumption = this.value;
    console.log(`Selected consumption unit: ${consumption}`);
    // Update your visualization logic here based on the selected consumption unit
  });

  // #endregion

  // // #region Bar Chart

  // // Group data by year and calculate total consumption for each year
  // function getYearlyConsumption(data, consumptionUnit) {
  //   const yearlyData = d3.rollup(data, 
  //     v => d3.sum(v, d => d[consumptionUnit]), 
  //     d => d["Revenue Month"].getFullYear()
  //   );
  //   return Array.from(yearlyData, ([year, totalConsumption]) => ({ year, totalConsumption }));
  // }

  // // Create the bar chart
  // function createBarChart(data) {
  //   const margin = { top: 20, right: 30, bottom: 40, left: 40 };
  //   const width = 800 - margin.left - margin.right;
  //   const height = 400 - margin.top - margin.bottom;

  //   const svg = d3.select("#bar-chart")
  //     .append("svg")
  //     .attr("width", width + margin.left + margin.right)
  //     .attr("height", height + margin.top + margin.bottom)
  //     .append("g")
  //     .attr("transform", `translate(${margin.left},${margin.top})`);

  //   const x = d3.scaleBand()
  //     .domain(data.map(d => d.year))
  //     .range([0, width])
  //     .padding(0.1);

  //   const y = d3.scaleLinear()
  //     .domain([0, d3.max(data, d => d.totalConsumption)])
  //     .nice()
  //     .range([height, 0]);

  //   svg.append("g")
  //     .selectAll(".bar")
  //     .data(data)
  //     .enter().append("rect")
  //     .attr("class", "bar")
  //     .attr("x", d => x(d.year))
  //     .attr("y", d => y(d.totalConsumption))
  //     .attr("width", x.bandwidth())
  //     .attr("height", d => height - y(d.totalConsumption))
  //     .attr("fill", "steelblue");

  //   svg.append("g")
  //     .attr("class", "x-axis")
  //     .attr("transform", `translate(0,${height})`)
  //     .call(d3.axisBottom(x));

  //   svg.append("g")
  //     .attr("class", "y-axis")
  //     .call(d3.axisLeft(y));
  // }

  // // Update the bar chart based on the filtered data
  // function updateBarChart() {
  //   const filteredData = filterData();
  //   const yearlyConsumption = getYearlyConsumption(filteredData, consumption);
  //   d3.select("#bar-chart").selectAll("*").remove();
  //   createBarChart(yearlyConsumption);
  // }

  // // Initial bar chart
  // updateBarChart();

  // // Update bar chart whenever the slider values or consumption unit change
  // dateSlider.noUiSlider.on('change', updateBarChart);
  // consumptionSelect.addEventListener('change', updateBarChart);
});