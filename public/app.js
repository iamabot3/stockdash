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

    // Update color based on the mood
    const score = parseInt(data.current.score);
    let color;
    if (score <= 25) color = '#FF4136'; // Extreme Fear
    else if (score <= 45) color = '#FF851B'; // Fear
    else if (score <= 55) color = '#FFDC00'; // Neutral
    else if (score <= 75) color = '#2ECC40'; // Greed
    else color = '#00BE3F'; // Extreme Greed

    scoreElement.style.color = color;
}

function updateChart(history) {
    const dates = history.map(item => item.timestamp);
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
            size: 6
        }
    };

    const layout = {
        title: 'Fear & Greed Index History',
        xaxis: {
            title: 'Date',
            showgrid: true
        },
        yaxis: {
            title: 'Index Value',
            range: [0, 100]
        }
    };

    Plotly.newPlot('historyChart', [trace], layout);
}

// Initial load
fetchLatestData();

// Refresh every 5 minutes
setInterval(fetchLatestData, 5 * 60 * 1000); 