# ⚡ EV ChargeFinder

### Electric Vehicle Charging Station Locator

EV ChargeFinder is a mobile application developed using React Native, Expo, and TypeScript to help electric vehicle users discover charging stations, explore connector types, and estimate charging costs.

## ✨ Features

* 🗺️ **Interactive Map** — View charging stations on a map.
* 📍 **Current Location** — Find stations near your current location.
* 🔎 **Station Search** — Search by station name, address, operator, or connector.
* 🔌 **Connector Filters** — Filter stations by connector type.
* ⚡ **Station Details** — View station information, including charging power when available.
* 🧭 **Google Maps Directions** — Open navigation to a selected station.
* 💰 **Charging Cost Calculator** — Estimate charging costs based on battery capacity, charge percentage, and electricity rate.
* 📱 **Mobile-Friendly UI** — A simple interface designed for mobile devices.

## 🛠️ Technologies Used

* React Native
* Expo
* TypeScript
* Expo Router
* React Native Maps
* Expo Location
* React Native Reanimated
* Git and GitHub

## 📂 Project Structure

```text
EVChargeFinder/
├── src/
│   └── app/
│       ├── _layout.tsx
│       ├── index.tsx
│       └── explore.tsx
├── package.json
├── app.json
├── tsconfig.json
└── README.md
```

*This is an illustrative structure; your actual project may contain additional files.*

## 🚀 Getting Started

### Prerequisites

Install Node.js and npm. You will also need Expo Go or a compatible development build to run the app on a mobile device.

### 1. Clone the Repository


```bash
git clone https://github.com/kamala-rgb/EVChargeFinder.git
```

### 2. Open the Project Directory

```bash
cd EVChargeFinder
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Application

```bash
npx expo start
```

Follow the terminal instructions to run the app on a compatible device or emulator.

## 💰 Charging Cost Calculator

The application estimates the energy required to charge a battery from its current percentage to a target percentage.

**Energy required (kWh):**

Battery capacity × (Target charge − Current charge) ÷ 100

**Estimated charging cost (₹):**

Energy required × Electricity rate per kWh

The result is an estimate. Actual costs may vary because of charging losses, station fees, taxes, and provider rates.

## 📍 Charging Station Data

Charging station information depends on the data source configured in the application. Station coverage and information accuracy may vary.

Users should verify station locations, connector compatibility, operating status, and charging prices before travelling.

## 🔒 Permissions and Privacy

* Location permission is requested for location-based features.
* Users can deny location access through their device settings.
* Never commit passwords, API keys, or private credentials to a public repository.

## 🎓 Project Information

* **Project:** EV ChargeFinder
* **Domain:** Electric Vehicle Technology
* **Purpose:** EV charging station discovery and cost estimation
* **Developed for:** Internship project

## 👨‍💻 Author

**Kamalakanta Hati**

https://github.com/kamala-rgb



*Developed for educational and demonstration purposes.*
