# StormCellar
A containerized JS service that fetches weather data from OpenWeatherMap's One Call API 3.0 and publishes the current hour's weather ID to an MQTT broker. 

Why this exist TLDR: This service was created for my FrontSignal Project. Which is a repurposed traffic signal that displays color codes based off weather conditions. This signal will hang from my shop for me and neighbors to visualize. However, I figured why not make this accessable for anyone. Thus I engineered a scaled 3d printable version. Ultimately I didnt want all of this code running on the ESP-32-C3. Its much simpler to just have it subscribe to a topic. I can also make as many of these as I want now without increasing API call count. I am by no means a developer, SRE by trade so I have to know how code works. With some help from claude I have wrote this service.

# Table of Contents
- [Features](#features)
- [Environment Variables](#environment-variables)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [MQTT Format](#mqtt-format)
- [Weather Condition Codes](#weather-condition-codes)
- [Roadmap](#roadmap)

## Features
- Fetches weather data using OpenWeatherMap One Call API 3.0
- Publishes weather_id for the current hour to MQTT
- Runs on container start and then hourly on the hour (timezone-aware).
- Configurable via environment variables with sensible defaults
- Containerized with Docker for easy deployment
- Graceful error handling and logging

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENWEATHER_API_KEY` | ✅ | - | Your OpenWeatherMap API key |
| `LAT` | ❌ | 40.7484 | Latitude (NYC default) |
| `LON` | ❌ | -73.9967 | Longitude (NYC default) |
| `MQTT_BROKER` | ❌ | localhost | MQTT broker IP/hostname |
| `MQTT_PORT` | ❌ | 1883 | MQTT broker port |
| `MQTT_TOPIC` | ❌ | weather/data | MQTT topic to publish to |
| `TZ` | ❌ | America/New_York | Timezone for scheduling |

## Quick Start
### Prerequisites
1. You will require an OpenWeatherMap One-Call-3 API Key.
> [!NOTE]
> This requires an account with a card on file.
2. Docker and Docker Compose(Recommended) Installed.

### Setup
1. Grab the docker-compose file from main branch.
``` bash
curl -O https://raw.githubusercontent.com/mrfoureyed/stormcellar/main/docker-compose.yaml
```
2. Update the environment vars to reflect your use case/setup.
3. Run:
```bash
docker compose up -D
```
And thats it, your publisher will be up and running!

### Build From Source Alternative
1. Clone the repo.
```bash
git clone https://github.com/mrfoureyed/stormcellar.git
```
2. CD into the directory & Build.
```bash
cd stormcellar && docker build -t stormcellar .
```
3. Run the container.
```bash
docker run -d --name stormcellar -e LAT= -e LON= -e MQTT_BROKER= -e OPENWEATHER_API_KEY= stormcellar
```

## How It Works
1. **Startup:** StormCellar Immediately connects to the MQTT Broker and fetches weather once at container start.
2. **Scheduling:** Calculates time until next hour and schedules subseqyuent runs.
3. **Data Processing:** Extracts weather_id from hourly data for the current hour.
>[!NOTE]
A 2min delay was put in place to ensure CURRENT hour data is fetched by the API.
4. **Publishing:** Sends JSON message to the MQTT Broker/Topic.

## MQTT Format
```json
{
    "weather_id": 800,
    "timestamp": "2025-06-30T15:00:00.000Z",
    "timezone": "America/New_York"
}
```
## Weather Condition Codes
Weather IDs correspond to OpenWeatherMap weather conditions - [OWM Weather Condition Docs](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2):
- 2xx: Thunderstorm
- 3xx: Drizzle
- 5xx: Rain
- 6xx: Snow
- 7xx: Atmosphere (fog, haze, etc.)
- 800: Clear sky
- 80x: Clouds

## Roadmap
Testing Container build
