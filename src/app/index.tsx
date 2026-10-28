
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

type ChargingStation = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  power: number;
  price: number | null;
  available: boolean | null;
  standards: string[];
  operator?: string;
};

type UserCoordinates = {
  latitude: number;
  longitude: number;
};

const DEFAULT_LOCATION: UserCoordinates = {
  latitude: 20.2961,
  longitude: 85.8245,
};

const DEFAULT_REGION: Region = {
  ...DEFAULT_LOCATION,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const CONNECTOR_OPTIONS = [
  'All',
  'CCS2',
  'Type 2',
  'CHAdeMO',
  'Bharat AC-001',
  'Bharat DC-001',
];

const DEFAULT_ELECTRICITY_RATE = 18;

function calculateDistance(
  pointA: UserCoordinates,
  pointB: UserCoordinates
): number {
  const earthRadiusKm = 6371;

  const latDifference =
    ((pointB.latitude - pointA.latitude) * Math.PI) / 180;

  const lonDifference =
    ((pointB.longitude - pointA.longitude) * Math.PI) / 180;

  const latA = (pointA.latitude * Math.PI) / 180;
  const latB = (pointB.latitude * Math.PI) / 180;

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(latA) *
    Math.cos(latB) *
    Math.sin(lonDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export default function HomeScreen() {
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState('');
  const [reloadStations, setReloadStations] = useState(0);

  const scrollY = useSharedValue(0);
  const [mapTopPosition, setMapTopPosition] = useState(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const stickyMapStyle = useAnimatedStyle(() => {
    const top = Math.max(mapTopPosition - scrollY.value, 0);

    return {
      top,
    };
  });

  const [userLocation, setUserLocation] =
    useState<UserCoordinates | null>(null);

  const mapRef = React.useRef<MapView>(null);

  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedStation, setSelectedStation] =
    useState<ChargingStation | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConnector, setSelectedConnector] = useState('All');

  const [batteryCapacity, setBatteryCapacity] = useState('40');
  const [chargePercentage, setChargePercentage] = useState('20');
  const [targetPercentage, setTargetPercentage] = useState('80');
  const [electricityRate, setElectricityRate] = useState(
    String(DEFAULT_ELECTRICITY_RATE)
  );

  const fetchStations = useCallback(async () => {
    setStationsLoading(true);
    setStationsError('');

    const coordinates = userLocation ?? DEFAULT_LOCATION;

    const url =
      'https://ev-charging-stations-api.vercel.app/v1/stations/near' +
      `?lat=${coordinates.latitude}` +
      `&lng=${coordinates.longitude}` +
      '&radius=50' +
      '&state=Odisha' +
      '&limit=50';

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const json = await response.json();

      const rawStations = Array.isArray(json)
        ? json
        : Array.isArray(json?.stations)
          ? json.stations
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.data?.stations)
              ? json.data.stations
              : [];

      const mappedStations: ChargingStation[] = rawStations
        .map((item: any, index: number) => {
          const latitude = Number(
            item.latitude ?? item.lat ?? item.location?.latitude
          );

          const longitude = Number(
            item.longitude ?? item.lng ?? item.lon ?? item.location?.longitude
          );

          const rawStandards =
            item.standards ??
            item.connectors ??
            item.connector_types ??
            item.connectorTypes ??
            [];

          const standards: string[] = Array.isArray(rawStandards)
            ? rawStandards.map((standard: any) =>
              typeof standard === 'string'
                ? standard
                : String(
                  standard?.standard ??
                  standard?.type ??
                  standard?.name ??
                  ''
                )
            )
            : typeof rawStandards === 'string'
              ? [rawStandards]
              : [];

          const rawPower = Number(
            item.max_power_kw ??
            item.power_kw ??
            item.power ??
            item.maxPower ??
            0
          );

          return {
            id: String(item.id ?? item.station_id ?? index),
            name:
              item.name ??
              item.station_name ??
              item.operator ??
              'EV Charging Station',
            address:
              item.address ??
              item.location_name ??
              item.city ??
              'Address not available',
            latitude,
            longitude,
            power: Number.isFinite(rawPower) ? rawPower : 0,
            price: null,
            available: null,
            standards: standards.filter(Boolean),
            operator: item.operator ?? item.network ?? undefined,
          };
        })
        .filter(
          (station: ChargingStation) =>
            Number.isFinite(station.latitude) &&
            Number.isFinite(station.longitude) &&
            Math.abs(station.latitude) <= 90 &&
            Math.abs(station.longitude) <= 180
        );

      setStations(mappedStations);

      if (mappedStations.length === 0) {
        setStationsError(
          'No stations were returned. Try refreshing or moving the map.'
        );
      }
    } catch (error) {
      console.error('Error fetching charging stations:', error);

      setStations([]);
      setStationsError(
        'Unable to load charging stations. Check your internet connection and try again.'
      );
    } finally {
      setStationsLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations, reloadStations]);

  const requestCurrentLocation = async () => {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Location permission required',
          'Allow location access to find charging stations near you.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coordinates: UserCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coordinates);

      setMapRegion({
        ...coordinates,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      });

      setSelectedStation(null);
    } catch (error) {
      console.error('Location error:', error);

      Alert.alert(
        'Location unavailable',
        'Unable to get your current location. Please try again.'
      );
    }
  };

  const filteredStations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return stations
      .filter((station) => {
        const matchesSearch =
          !query ||
          station.name.toLowerCase().includes(query) ||
          station.address.toLowerCase().includes(query) ||
          (station.operator ?? '').toLowerCase().includes(query) ||
          station.standards.some((standard) =>
            standard.toLowerCase().includes(query)
          );

        const matchesConnector =
          selectedConnector === 'All' ||
          station.standards.some((standard) =>
            standard.toLowerCase().includes(selectedConnector.toLowerCase())
          );

        return matchesSearch && matchesConnector;
      })
      .sort((a, b) => {
        if (!userLocation) return a.name.localeCompare(b.name);

        const distanceA = calculateDistance(userLocation, a);
        const distanceB = calculateDistance(userLocation, b);

        return distanceA - distanceB;
      });
  }, [stations, searchQuery, selectedConnector, userLocation]);

  const nearestStation = useMemo(() => {
    if (!userLocation || stations.length === 0) return null;

    return stations.reduce((nearest, current) => {
      const nearestDistance = calculateDistance(userLocation, nearest);
      const currentDistance = calculateDistance(userLocation, current);

      return currentDistance < nearestDistance ? current : nearest;
    });
  }, [stations, userLocation]);

  const openDirections = async (station: ChargingStation) => {
    const url =
      'https://www.google.com/maps/dir/?api=1' +
      `&destination=${station.latitude},${station.longitude}` +
      '&travelmode=driving';

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open Google Maps.');
    }
  };


  const zoomIn = () => {
    mapRef.current?.getCamera().then((camera) => {
      if (camera.zoom !== undefined) {
        mapRef.current?.animateCamera({
          zoom: camera.zoom + 1,
        });
      }
    });
  };

  const zoomOut = () => {
    mapRef.current?.getCamera().then((camera) => {
      if (camera.zoom !== undefined) {
        mapRef.current?.animateCamera({
          zoom: camera.zoom - 1,
        });
      }
    });
  };

  const goToCurrentLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please allow location access to find your current position.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setMapRegion(region);

      mapRef.current?.animateToRegion(region, 800);
    } catch {
      Alert.alert(
        'Location error',
        'Unable to get your current location. Please try again.'
      );
    }
  };

  const energyRequired = useMemo(() => {
    const capacity = Number(batteryCapacity);
    const current = Number(chargePercentage);
    const target = Number(targetPercentage);

    if (
      !Number.isFinite(capacity) ||
      !Number.isFinite(current) ||
      !Number.isFinite(target) ||
      capacity <= 0 ||
      current < 0 ||
      current > 100 ||
      target < 0 ||
      target > 100 ||
      target < current
    ) {
      return null;
    }

    return (capacity * (target - current)) / 100;
  }, [batteryCapacity, chargePercentage, targetPercentage]);

  const estimatedCost = useMemo(() => {
    const rate = Number(electricityRate);

    if (
      energyRequired === null ||
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      return null;
    }

    return energyRequired * rate;
  }, [energyRequired, electricityRate]);

  const formatDistance = (station: ChargingStation) => {
    if (!userLocation) return null;

    return calculateDistance(userLocation, station).toFixed(1);
  };

  const renderStationDetails = (station: ChargingStation) => {
    const distance = formatDistance(station);

    return (
      <>
        <Text style={styles.stationAddress}>{station.address}</Text>

        {station.operator ? (
          <Text style={styles.detailText}>
            Operator: {station.operator}
          </Text>
        ) : null}

        <View style={styles.stationDetails}>
          <View style={styles.detailBadge}>
            <Text style={styles.detailBadgeText}>
              ⚡ {station.power > 0 ? `${station.power} kW` : 'Power N/A'}
            </Text>
          </View>

          {distance !== null ? (
            <View style={styles.detailBadge}>
              <Text style={styles.detailBadgeText}>
                📍 {distance} km away
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.connectorLabel}>Connectors</Text>

        <Text style={styles.connectorText}>
          {station.standards.length > 0
            ? station.standards.join(', ')
            : 'Connector information unavailable'}
        </Text>

        <Text style={styles.availabilityNote}>
          Live availability and charging prices are not provided by this data source.
        </Text>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <Animated.ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>EV ChargeFinder</Text>
            <Text style={styles.appSubtitle}>
              Find charging stations near you
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>⚡</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search station, location, connector..."
            placeholderTextColor="#829188"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterHeading}>
          <Text style={styles.sectionTitle}>Connector type</Text>
          <Text style={styles.resultCount}>
            {filteredStations.length} found
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.connectorScroll}
          contentContainerStyle={styles.connectorOptions}
        >
          {CONNECTOR_OPTIONS.map((connector) => {
            const isSelected = selectedConnector === connector;

            return (
              <TouchableOpacity
                key={connector}
                style={[
                  styles.connectorChip,
                  isSelected && styles.connectorChipSelected,
                ]}
                onPress={() => setSelectedConnector(connector)}
              >
                <Text
                  style={[
                    styles.connectorChipText,
                    isSelected && styles.connectorChipTextSelected,
                  ]}
                >
                  {connector}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.mapHeading}>
          <Text style={styles.sectionTitle}>Charging stations map</Text>

          <TouchableOpacity
            style={styles.locationButton}
            onPress={requestCurrentLocation}
          >
            <Text style={styles.locationButtonText}>◎ My location</Text>
          </TouchableOpacity>
        </View>



        <View
          onLayout={(event) => {
            setMapTopPosition(event.nativeEvent.layout.y);
          }}
          style={styles.mapContainer}
        />




        {stationsError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{stationsError}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setReloadStations((value) => value + 1)}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {nearestStation && userLocation ? (
          <View style={styles.nearestCard}>
            <View style={styles.nearestIcon}>
              <Text style={styles.nearestIconText}>⚡</Text>
            </View>

            <View style={styles.nearestContent}>
              <Text style={styles.nearestLabel}>NEAREST STATION</Text>
              <Text style={styles.nearestName} numberOfLines={2}>
                {nearestStation.name}
              </Text>
              <Text style={styles.nearestDistance}>
                {calculateDistance(userLocation, nearestStation).toFixed(1)} km
                from your location
              </Text>
            </View>

            <TouchableOpacity
              style={styles.nearestArrow}
              onPress={() => {
                setSelectedStation(nearestStation);
                setMapRegion({
                  latitude: nearestStation.latitude,
                  longitude: nearestStation.longitude,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                });
              }}
            >
              <Text style={styles.nearestArrowText}>›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedStation ? (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <View style={styles.selectedTitleContainer}>
                <Text style={styles.cardEyebrow}>STATION DETAILS</Text>
                <Text style={styles.selectedName}>
                  {selectedStation.name}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedStation(null)}
                style={styles.closeButtonContainer}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {renderStationDetails(selectedStation)}

            <TouchableOpacity
              style={styles.directionsButton}
              onPress={() => openDirections(selectedStation)}
            >
              <Text style={styles.directionsButtonText}>
                ↗ Get directions in Google Maps
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.listHeading}>
          <View>
            <Text style={styles.sectionTitle}>Nearby stations</Text>
            <Text style={styles.sectionSubtitle}>
              Select a station to view details
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setReloadStations((value) => value + 1)}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshButtonText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {!stationsLoading && filteredStations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔌</Text>
            <Text style={styles.emptyTitle}>No stations found</Text>
            <Text style={styles.emptyText}>
              Try another search term or connector filter.
            </Text>
          </View>
        ) : (
          <View style={styles.stationList}>
            {filteredStations.map((station) => {
              const isSelected = selectedStation?.id === station.id;
              const distance = formatDistance(station);

              return (
                <TouchableOpacity
                  key={station.id}
                  style={[
                    styles.stationCard,
                    isSelected && styles.stationCardSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedStation(station);

                    setMapRegion({
                      latitude: station.latitude,
                      longitude: station.longitude,
                      latitudeDelta: 0.04,
                      longitudeDelta: 0.04,
                    });
                  }}
                >
                  <View style={styles.stationIcon}>
                    <Text style={styles.stationIconText}>⚡</Text>
                  </View>

                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName} numberOfLines={2}>
                      {station.name}
                    </Text>

                    <Text style={styles.stationAddress} numberOfLines={2}>
                      {station.address}
                    </Text>

                    <View style={styles.stationMeta}>
                      <Text style={styles.powerText}>
                        {station.power > 0
                          ? `${station.power} kW`
                          : 'Power N/A'}
                      </Text>

                      {distance !== null ? (
                        <Text style={styles.distanceText}>
                          {distance} km
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.listConnectorText} numberOfLines={2}>
                      {station.standards.length > 0
                        ? station.standards.join(', ')
                        : 'Connector details unavailable'}
                    </Text>
                  </View>

                  <Text style={styles.stationArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.calculatorCard}>
          <View style={styles.calculatorHeader}>
            <View style={styles.calculatorIcon}>
              <Text style={styles.calculatorIconText}>₹</Text>
            </View>

            <View style={styles.calculatorHeaderText}>
              <Text style={styles.sectionTitle}>Charging cost calculator</Text>
              <Text style={styles.sectionSubtitle}>
                Estimate your charging expense
              </Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>Battery capacity (kWh)</Text>
          <TextInput
            style={styles.numberInput}
            value={batteryCapacity}
            onChangeText={setBatteryCapacity}
            keyboardType="decimal-pad"
            placeholder="e.g. 40"
          />

          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <Text style={styles.inputLabel}>Current charge (%)</Text>
              <TextInput
                style={styles.numberInput}
                value={chargePercentage}
                onChangeText={setChargePercentage}
                keyboardType="decimal-pad"
                placeholder="20"
              />
            </View>

            <View style={styles.inputColumn}>
              <Text style={styles.inputLabel}>Target charge (%)</Text>
              <TextInput
                style={styles.numberInput}
                value={targetPercentage}
                onChangeText={setTargetPercentage}
                keyboardType="decimal-pad"
                placeholder="80"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Electricity rate (₹ per kWh)</Text>
          <TextInput
            style={styles.numberInput}
            value={electricityRate}
            onChangeText={setElectricityRate}
            keyboardType="decimal-pad"
            placeholder="18"
          />

          <View style={styles.costResult}>
            <Text style={styles.costResultLabel}>Estimated charging cost</Text>

            <Text style={styles.costResultValue}>
              {estimatedCost === null
                ? 'Check your inputs'
                : `₹${estimatedCost.toFixed(2)}`}
            </Text>

            <Text style={styles.costResultNote}>
              {energyRequired === null
                ? 'Enter valid battery capacity and charging percentages.'
                : `${energyRequired.toFixed(2)} kWh estimated energy required`}
            </Text>
          </View>

          <Text style={styles.disclaimer}>
            Estimate only. Actual costs may vary due to charging losses,
            station fees, taxes, and provider rates.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>EV ChargeFinder</Text>
          <Text style={styles.footerText}>
            Helping you find your next charging stop.
          </Text>
          <Text style={styles.footerDisclaimer}>
            Station information may be incomplete or outdated. Verify details
            with the charging network before travelling.
          </Text>
        </View>
      </Animated.ScrollView>

      {mapTopPosition > 0 && (
        <Animated.View
          style={[
            styles.stickyMapOverlay,
            stickyMapStyle,
          ]}
        >

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
              showsUserLocation={Boolean(userLocation)}
              showsMyLocationButton={false}

            >

              {filteredStations.map((station) => (
                <Marker
                  key={station.id}
                  coordinate={{
                    latitude: station.latitude,
                    longitude: station.longitude,
                  }}
                  title={station.name}
                  description={station.address}
                  pinColor={
                    selectedStation?.id === station.id
                      ? '#F59E0B'
                      : '#16803C'
                  }
                  onPress={() => setSelectedStation(station)}
                />
              ))}
            </MapView>



            <View style={styles.mapControls}>
              <TouchableOpacity
                style={styles.mapControlButton}
                onPress={zoomIn}
                accessibilityLabel="Zoom in"
              >
                <Text style={styles.mapControlText}>+</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapControlButton}
                onPress={zoomOut}
                accessibilityLabel="Zoom out"
              >
                <Text style={styles.mapControlText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapControlButton}
                onPress={goToCurrentLocation}
                accessibilityLabel="Go to current location"
              >
                <Text style={styles.locationControlText}>📍</Text>
              </TouchableOpacity>
            </View>


            {stationsLoading && (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#16803C" />
                <Text style={styles.mapLoadingText}>
                  Loading charging stations...
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </SafeAreaView>

  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FAF6',
  },

  mainScroll: {
    flex: 1,
  },

  mainScrollContent: {
    paddingBottom: 30,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  appTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#174A2A',
  },

  appSubtitle: {
    fontSize: 13,
    color: '#718277',
    marginTop: 4,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#DDF4E3',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerIconText: {
    fontSize: 27,
  },

  searchContainer: {
    marginHorizontal: 18,
    marginBottom: 22,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EAE2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  searchIcon: {
    fontSize: 25,
    color: '#5C8067',
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#213A29',
  },

  clearSearch: {
    fontSize: 17,
    color: '#708078',
    padding: 5,
  },

  filterHeading: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3D29',
  },

  resultCount: {
    fontSize: 12,
    color: '#6F8275',
  },

  connectorScroll: {
    marginTop: 12,
    marginBottom: 22,
  },

  connectorOptions: {
    paddingHorizontal: 18,
    paddingRight: 24,
  },

  connectorChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE8DF',
    marginRight: 8,
  },

  connectorChipSelected: {
    backgroundColor: '#1B6B38',
    borderColor: '#1B6B38',
  },

  connectorChipText: {
    color: '#48604F',
    fontSize: 12,
    fontWeight: '600',
  },

  connectorChipTextSelected: {
    color: '#FFFFFF',
  },

  mapHeading: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  locationButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#E1F3E5',
  },

  locationButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A6B36',
  },

  mapContainer: {
    height: 300,
    marginHorizontal: 18,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E5ECE7',
    borderWidth: 1,
    borderColor: '#DDE7DF',
  },

  map: {
    flex: 1,
  },

  mapLoading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(245,250,246,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mapLoadingText: {
    color: '#285338',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },

  errorCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: '#FFF0EF',
    borderColor: '#F3D0CD',
    borderWidth: 1,
    padding: 15,
    borderRadius: 14,
  },

  errorText: {
    color: '#A83C35',
    fontSize: 13,
    lineHeight: 19,
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#B84038',
    borderRadius: 9,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  nearestCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 15,
    backgroundColor: '#E5F5E8',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D2EBD7',
  },

  nearestIcon: {
    width: 45,
    height: 45,
    backgroundColor: '#C8EAD0',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  nearestIconText: {
    fontSize: 23,
  },

  nearestContent: {
    flex: 1,
  },

  nearestLabel: {
    color: '#448054',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },

  nearestName: {
    color: '#194B29',
    fontSize: 14,
    fontWeight: '700',
  },

  nearestDistance: {
    color: '#5A7761',
    fontSize: 12,
    marginTop: 4,
  },

  nearestArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  nearestArrowText: {
    fontSize: 25,
    color: '#1B6B38',
    marginTop: -3,
  },

  selectedCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFE5D4',
  },

  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  selectedTitleContainer: {
    flex: 1,
    paddingRight: 10,
  },

  cardEyebrow: {
    color: '#258047',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },

  selectedName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1B3E27',
  },

  closeButtonContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0F5F1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeButton: {
    color: '#52685A',
    fontSize: 17,
  },

  stationAddress: {
    color: '#728077',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  detailText: {
    fontSize: 12,
    color: '#68776C',
    marginTop: 8,
  },

  stationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 12,
  },

  detailBadge: {
    backgroundColor: '#EAF6EC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 7,
    marginBottom: 5,
  },

  detailBadgeText: {
    fontSize: 12,
    color: '#26683A',
    fontWeight: '700',
  },

  connectorLabel: {
    color: '#294733',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  connectorText: {
    color: '#66766B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  availabilityNote: {
    color: '#8A7750',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },

  directionsButton: {
    backgroundColor: '#1C713A',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 15,
  },

  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  listHeading: {
    marginTop: 26,
    marginBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionSubtitle: {
    color: '#87948B',
    fontSize: 12,
    marginTop: 5,
  },

  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E3F3E7',
  },

  refreshButtonText: {
    color: '#236A38',
    fontSize: 12,
    fontWeight: '700',
  },

  stationList: {
    paddingHorizontal: 18,
  },

  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4ECE5',
    padding: 13,
    marginBottom: 11,
  },

  stationCardSelected: {
    borderColor: '#258047',
    backgroundColor: '#F0F9F1',
  },

  stationIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#E4F4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stationIconText: {
    fontSize: 22,
  },

  stationInfo: {
    flex: 1,
    paddingRight: 6,
  },

  stationName: {
    color: '#263E2E',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },

  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },

  powerText: {
    color: '#237340',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 12,
  },

  distanceText: {
    color: '#718078',
    fontSize: 11,
  },

  listConnectorText: {
    color: '#849087',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },

  stationArrow: {
    color: '#71917A',
    fontSize: 27,
    paddingLeft: 4,
  },

  emptyCard: {
    marginHorizontal: 18,
    padding: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4ECE5',
  },

  emptyIcon: {
    fontSize: 32,
    marginBottom: 10,
  },

  emptyTitle: {
    color: '#274832',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyText: {
    color: '#839087',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 7,
  },

  calculatorCard: {
    marginHorizontal: 18,
    marginTop: 26,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EBE3',
  },

  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  calculatorIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#DFF2E3',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  calculatorIconText: {
    color: '#1B6B38',
    fontSize: 23,
    fontWeight: '800',
  },

  calculatorHeaderText: {
    flex: 1,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6050',
    marginBottom: 7,
    marginTop: 4,
  },

  numberInput: {
    minHeight: 46,
    backgroundColor: '#F7FAF7',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFE8E0',
    paddingHorizontal: 13,
    color: '#233D2B',
    fontSize: 14,
    marginBottom: 14,
  },

  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },

  inputColumn: {
    flex: 1,
  },

  costResult: {
    backgroundColor: '#E5F5E8',
    padding: 17,
    borderRadius: 14,
    marginTop: 4,
  },

  costResultLabel: {
    color: '#477451',
    fontSize: 12,
    fontWeight: '600',
  },

  costResultValue: {
    color: '#165C2D',
    fontSize: 29,
    fontWeight: '800',
    marginTop: 6,
  },

  costResultNote: {
    color: '#5F7C66',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  disclaimer: {
    color: '#8A958C',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },

  footer: {
    marginTop: 28,
    paddingHorizontal: 25,
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5ECE6',
  },

  footerTitle: {
    color: '#245634',
    fontSize: 14,
    fontWeight: '800',
  },

  footerText: {
    color: '#7C8A80',
    fontSize: 11,
    marginTop: 5,
  },

  footerDisclaimer: {
    color: '#929C94',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 10,
  },
  stickyMapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },

  mapControls: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 10,
  },

  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  mapControlText: {
    fontSize: 27,
    fontWeight: '600',
    color: '#16803C',
  },

  locationControlText: {
    fontSize: 21,
  },
});
