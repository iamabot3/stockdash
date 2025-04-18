function createGauge() {
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;
    
    // Clear existing content
    d3.select("#gauge-chart").html("");
    
    const svg = d3.select("#gauge-chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Create gradient
    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "gauge-gradient")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", -radius).attr("y1", 0)
        .attr("x2", radius).attr("y2", 0);

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#FF4136"); // Extreme Fear

    gradient.append("stop")
        .attr("offset", "25%")
        .attr("stop-color", "#FF851B"); // Fear

    gradient.append("stop")
        .attr("offset", "50%")
        .attr("stop-color", "#FFDC00"); // Neutral

    gradient.append("stop")
        .attr("offset", "75%")
        .attr("stop-color", "#2ECC40"); // Greed

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#00BE3F"); // Extreme Greed

    // Create gauge background
    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius * 0.8)
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    svg.append("path")
        .attr("d", arc)
        .style("fill", "url(#gauge-gradient)");

    // Add tick marks
    const scale = d3.scaleLinear()
        .domain([0, 100])
        .range([-90, 90]);

    const ticks = [0, 25, 50, 75, 100];
    
    svg.selectAll(".tick")
        .data(ticks)
        .enter()
        .append("line")
        .attr("class", "tick")
        .attr("x1", 0)
        .attr("y1", -radius * 0.6)
        .attr("x2", 0)
        .attr("y2", -radius * 0.55)
        .attr("transform", d => `rotate(${scale(d)})`)
        .style("stroke", "#666")
        .style("stroke-width", 2);

    return svg;
}

function updateGauge(score) {
    const svg = d3.select("#gauge-chart g");
    
    // Remove existing needle
    svg.selectAll(".needle").remove();
    
    const radius = Math.min(300, 300) / 2;
    const scale = d3.scaleLinear()
        .domain([0, 100])
        .range([-Math.PI / 2, Math.PI / 2]);

    // Create needle
    const needle = svg.append("path")
        .attr("class", "needle")
        .attr("d", `M ${-radius * 0.05} 0 L ${radius * 0.65} 0 L ${-radius * 0.05} ${radius * 0.05} Z`)
        .attr("transform", `rotate(${scale(score) * 180 / Math.PI})`)
        .style("fill", "#2c3e50");
}

async function fetchLatestData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        updateDisplay(data);
        updateChart(data.history);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('mood').textContent = 'Error loading data';
    }
}

function updateDisplay(data) {
    const scoreElement = document.getElementById('score');
    const moodElement = document.getElementById('mood');
    const lastUpdateElement = document.getElementById('lastUpdate');

    scoreElement.textContent = data.current.score;
    moodElement.textContent = data.current.mood;
    
    const lastUpdate = new Date(data.current.timestamp);
    lastUpdateElement.textContent = `Last updated: ${lastUpdate.toLocaleString()}`;

    // Update gauge
    updateGauge(parseInt(data.current.score));
}

function updateChart(history) {
    const dates = history.map(item => new Date(item.timestamp));
    const scores = history.map(item => item.score);

    const trace = {
        x: dates,
        y: scores,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#2c3e50',
            width: 2
        },
        marker: {
            size: 6,
            color: scores.map(score => {
                if (score <= 25) return '#FF4136';
                if (score <= 45) return '#FF851B';
                if (score <= 55) return '#FFDC00';
                if (score <= 75) return '#2ECC40';
                return '#00BE3F';
            })
        }
    };

    const layout = {
        title: 'Fear & Greed Index History',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            title: 'Date',
            showgrid: true,
            gridcolor: '#eee'
        },
        yaxis: {
            title: 'Index Value',
            range: [0, 100],
            showgrid: true,
            gridcolor: '#eee'
        },
        margin: {
            l: 50,
            r: 20,
            t: 40,
            b: 40
        }
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot('historyChart', [trace], layout, config);
}

// Create initial gauge
createGauge();

// Initial load
fetchLatestData();

// Refresh every 5 minutes
setInterval(fetchLatestData, 5 * 60 * 1000); 