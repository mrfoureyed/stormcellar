const axios = require('axios');
const mqtt = require('mqtt');
const { consola } = require('consola');
const { VERSION } = require('./package.json')

// Environment variables with defaults
const config = {
  apiKey: process.env.OPENWEATHER_API_KEY,
  lat: parseFloat(process.env.LAT) || 40.7484,
  lon: parseFloat(process.env.LON) || -73.9967,
  mqttBroker: process.env.MQTT_BROKER || 'localhost',
  mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
  mqttTopic: process.env.MQTT_TOPIC || 'weather/data',
  timeZone: process.env.TZ || 'America/New_York'
};

// Validate required environment variables
if (!config.apiKey) {
  consola.error('OPENWEATHER_API_KEY is required');
  process.exit(1);
}

// MQTT client
let mqttClient;

/**
 * Initialize MQTT connection
 */
function initMqtt() {
  const brokerUrl = `mqtt://${config.mqttBroker}:${config.mqttPort}`;
  consola.info(`Connecting to MQTT broker: ${brokerUrl}`);
  
  mqttClient = mqtt.connect(brokerUrl);
  
  mqttClient.on('connect', () => {
    consola.success('Connected to MQTT broker');
  });
  
  mqttClient.on('error', (err) => {
    consola.error('MQTT connection error:', err);
  });
  
  mqttClient.on('disconnect', () => {
    consola.warn('Disconnected from MQTT broker');
  });
}

/**
 * Fetch weather data from OpenWeatherMap One Call API 3.0
 */
async function fetchWeatherData() {
  try {
    consola.info('Fetching weather data...');
    
    const url = 'https://api.openweathermap.org/data/3.0/onecall';
    const params = {
      lat: config.lat,
      lon: config.lon,
      appid: config.apiKey,
      exclude: 'minutely,daily,alerts' // We only need current and hourly
    };
    
    const response = await axios.get(url, { params });
    consola.success('Weather data fetched successfully');
    
    return response.data;
  } catch (error) {
    consola.error('Error fetching weather data:', error.message);
    if (error.response) {
      consola.error('API Response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Get the most recent hour's weather ID from hourly data
 * This handles cases where the API hasn't updated for the current hour yet
 */
function getCurrentHourWeatherId(weatherData) {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  const currentHourTimestamp = Math.floor(currentHour.getTime() / 1000);
  
  // First, try to find the exact current hour
  let targetHourData = weatherData.hourly.find(hour => {111
    const hourTimestamp = hour.dt;
    const hourDate = new Date(hourTimestamp * 1000);
    const hourStart = new Date(hourDate.getFullYear(), hourDate.getMonth(), hourDate.getDate(), hourDate.getHours(), 0, 0, 0);
    return Math.floor(hourStart.getTime() / 1000) === currentHourTimestamp;
  });
  
  // If current hour not found, find the most recent hour that's <= current time
  if (!targetHourData) {
    consola.warn('Current hour data not available, using most recent hour');
    
    // Sort hourly data by timestamp and find the most recent one before or at current time
    const recentHours = weatherData.hourly
      .filter(hour => hour.dt <= Math.floor(now.getTime() / 1000))
      .sort((a, b) => b.dt - a.dt); // Sort descending (most recent first)
    
    if (recentHours.length > 0) {
      targetHourData = recentHours[0];
      const hourDate = new Date(targetHourData.dt * 1000);
      consola.info(`Using weather data from ${hourDate.toLocaleString()}`);
    }
  } else {
    consola.success('Found current hour weather data');
  }
  
  if (targetHourData && targetHourData.weather && targetHourData.weather.length > 0) {
    return targetHourData.weather[0].id;
  }
  
  // Final fallback to current weather
  if (weatherData.current && weatherData.current.weather && weatherData.current.weather.length > 0) {
    consola.warn('Using current weather data as final fallback');
    return weatherData.current.weather[0].id;
  }
  
  throw new Error('No weather data available');
}

/**
 * Publish weather ID to MQTT
 */
function publishWeatherId(weatherId) {
  const message = {
    weather_id: weatherId,
    timestamp: new Date().toISOString(),
    timezone: config.timeZone
  };
  
  const payload = JSON.stringify(message);
  
  mqttClient.publish(config.mqttTopic, payload, { retain: true }, (err) => {
    if (err) {
      consola.error('Failed to publish MQTT message:', err);
    } else {
      consola.success(`Published weather_id ${weatherId} to ${config.mqttTopic}`);
    }
  });
}

/**
 * Main function to fetch and publish weather data
 */
async function fetchAndPublish() {
  try {
    const weatherData = await fetchWeatherData();
    const weatherId = getCurrentHourWeatherId(weatherData);
    publishWeatherId(weatherId);
  } catch (error) {
    consola.error('Error in fetchAndPublish:', error.message);
  }
}

/**
 * Calculate milliseconds until a few minutes past the next hour
 * This gives the API time to update with current hour data
 */
function msUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 2, 0, 0); // 2 minutes past the hour
  return nextHour.getTime() - now.getTime();
}

/**
 * Schedule the next execution at the top of the hour
 */
function scheduleNextRun() {
  const msUntilNext = msUntilNextHour();
  consola.info(`Next run scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    fetchAndPublish();
    // Schedule subsequent runs every hour
    setInterval(fetchAndPublish, 60 * 60 * 1000); // 1 hour in milliseconds
  }, msUntilNext);
}

/**
 * Main application entry point
 */
async function main() {
  consola.box('StormCellar',
    '\nFourEyed.net',
    `\nv:${VERSION}`
  );
  consola.info('Starting StormCellar');
  consola.info('Loaded Following Configuration:');
  consola.info(`Lat: ${config.lat}`);
  consola.info(`Lon: ${config.lon}`);
  consola.info(`MQTT Broker Address: ${config.mqttBroker}`);
  consola.info(`MQTT Port: ${config.mqttPort}`);
  consola.info(`Timezone: ${config.timeZone}`);
  
  // Initialize MQTT connection
  initMqtt();
  
  // Wait a moment for MQTT connection
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Initial fetch at startup
  await fetchAndPublish();
  
  // Schedule subsequent runs on the hour
  scheduleNextRun();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  consola.info('Received SIGINT, shutting down gracefully...');
  if (mqttClient) {
    mqttClient.end();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  consola.info('Received SIGTERM, shutting down gracefully...');
  if (mqttClient) {
    mqttClient.end();
  }
  process.exit(0);
});

// Start the application
main().catch(error => {
  consola.error('Application failed to start:', error);
  process.exit(1);
});