import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Navigation } from "lucide-react";


// National Petroleum gas station locations in Trinidad and Tobago
const NP_STATIONS = [
  { name: "NP - Curepe", coords: [-61.4147, 10.6403] as [number, number] },
  { name: "NP - Chaguanas", coords: [-61.4114, 10.5167] as [number, number] },
  { name: "NP - San Fernando", coords: [-61.4667, 10.2833] as [number, number] },
  { name: "NP - Port of Spain", coords: [-61.5167, 10.6667] as [number, number] },
  { name: "NP - Arima", coords: [-61.2833, 10.6333] as [number, number] },
  { name: "NP - Point Fortin", coords: [-61.6833, 10.1833] as [number, number] },
  { name: "NP - Princes Town", coords: [-61.3833, 10.2667] as [number, number] },
  { name: "NP - Sangre Grande", coords: [-61.1333, 10.5833] as [number, number] },
  { name: "NP - Diego Martin", coords: [-61.5500, 10.7000] as [number, number] },
  { name: "NP - Maraval", coords: [-61.5000, 10.6833] as [number, number] },
  { name: "NP - Tunapuna", coords: [-61.3833, 10.6500] as [number, number] },
  { name: "NP - Couva", coords: [-61.4667, 10.4167] as [number, number] },
  { name: "NP - Rio Claro", coords: [-61.1833, 10.3000] as [number, number] },
  { name: "NP - Fyzabad", coords: [-61.5000, 10.2000] as [number, number] },
  { name: "NP - Tobago - Scarborough", coords: [-60.7333, 11.1833] as [number, number] },
  { name: "NP - Tobago - Crown Point", coords: [-60.8333, 11.1500] as [number, number] },
];

interface DriverMapProps {
  onClose?: () => void;
}

const DriverMap: React.FC<DriverMapProps> = ({ onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mapbox_api_key') || '');
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const initializeMap = () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Mapbox API key to use the map",
        variant: "destructive",
      });
      return;
    }

    // Save API key to localStorage
    localStorage.setItem('mapbox_api_key', apiKey);

    if (!mapContainer.current) return;

    mapboxgl.accessToken = apiKey;

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords: [number, number] = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          setUserLocation(userCoords);

          // Initialize map centered on user location
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: userCoords,
            zoom: 13,
          });

          // Add navigation controls
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Add user location marker
          new mapboxgl.Marker({ color: '#3B82F6' })
            .setLngLat(userCoords)
            .setPopup(new mapboxgl.Popup().setHTML('<h3>Your Location</h3>'))
            .addTo(map.current);


          map.current.on('load', () => {
            setIsMapReady(true);
            addNPStations();
            searchNearbyPOIs(userCoords);
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Unable to get your location. Using default location.",
            variant: "destructive",
          });
          
          // Fallback to default location (Barbados)
          const defaultCoords: [number, number] = [-59.5432, 13.1939];
          setUserLocation(defaultCoords);
          
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: defaultCoords,
            zoom: 10,
          });

          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');


          map.current.on('load', () => {
            setIsMapReady(true);
            addNPStations();
            searchNearbyPOIs(defaultCoords);
          });
        }
      );
    }
  };

  const addNPStations = () => {
    if (!map.current) return;

    NP_STATIONS.forEach((station) => {
      const el = document.createElement('div');
      el.className = 'np-station-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#EF4444';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';

      new mapboxgl.Marker(el)
        .setLngLat(station.coords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3 style="font-weight: bold; margin-bottom: 4px;">⛽ ${station.name}</h3>
             <button 
               onclick="window.calculateRouteToNP('${station.coords[0]}', '${station.coords[1]}', '${station.name}')"
               style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer; margin-top: 4px;"
             >
               Get Directions
             </button>`
          )
        )
        .addTo(map.current!);
    });

    toast({
      title: "NP Stations Loaded",
      description: `${NP_STATIONS.length} National Petroleum stations available`,
    });
  };

  // Make calculateRoute available globally for popup buttons
  useEffect(() => {
    (window as any).calculateRouteToNP = (lon: string, lat: string, name: string) => {
      calculateRoute([parseFloat(lon), parseFloat(lat)], name);
    };
    return () => {
      delete (window as any).calculateRouteToNP;
    };
  }, [userLocation, apiKey]);

  const searchNearbyPOIs = async (coords: [number, number]) => {
    if (!map.current || !apiKey) return;

    try {
      const buildUrl = (query: string, useProximity: boolean) =>
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?limit=10&types=poi&access_token=${apiKey}` +
        (useProximity ? `&proximity=${coords[0]},${coords[1]}` : "");

      // Search for EV charging stations only (NP stations are now from our custom dataset)
      const evResponse = await fetch(buildUrl("ev charging station", true));
      let evData = await evResponse.json();

      // Fallback to broader search if nothing found nearby
      if (!evData.features || evData.features.length === 0) {
        const evFallback = await fetch(buildUrl("ev charging station", false));
        evData = await evFallback.json();
      }

      const evFeatures = evData.features || [];

      // Add EV charging station markers
      evFeatures.forEach((feature: any) => {
        const el = document.createElement('div');
        el.className = 'ev-charger-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#10B981';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';

        new mapboxgl.Marker(el)
          .setLngLat(feature.center)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<h3 style="font-weight: bold; margin-bottom: 4px;">🔌 EV Charger</h3>
               <p style="margin: 0;">${feature.place_name}</p>`
            )
          )
          .addTo(map.current!);
      });

      const evCount = evFeatures.length;

      toast({
        title: evCount === 0 ? "No EV Chargers Found" : "EV Chargers Loaded",
        description:
          evCount === 0
            ? "No EV chargers were found nearby."
            : `Found ${evCount} EV chargers`,
      });
    } catch (error) {
      console.error('Error fetching POIs:', error);
      toast({
        title: "Error",
        description: "Failed to load nearby stations",
        variant: "destructive",
      });
    }
  };

  const searchPOI = async () => {
    if (!searchQuery || !apiKey) return;

    try {
      // Trinidad and Tobago bounding box: [minLon, minLat, maxLon, maxLat]
      const ttBbox = '-61.95,10.0,-60.5,11.5';
      const baseUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        searchQuery
      )}.json`;

      // First try: within TT bbox
      const primaryResponse = await fetch(
        `${baseUrl}?bbox=${ttBbox}&country=TT&limit=10&access_token=${apiKey}`
      );
      let data = await primaryResponse.json();

      // Fallback: anywhere in TT without bbox if nothing found
      if (!data.features || data.features.length === 0) {
        const fallbackResponse = await fetch(
          `${baseUrl}?country=TT&limit=10&access_token=${apiKey}`
        );
        data = await fallbackResponse.json();
      }

      setSearchResults(data.features || []);
      setShowResults(true);

      if (!data.features || data.features.length === 0) {
        toast({
          title: "No Results",
          description: "No locations found in Trinidad and Tobago for that search.",
        });
      }
    } catch (error) {
      console.error('Error searching POI:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for locations",
        variant: "destructive",
      });
    }
  };

  const calculateRoute = async (destination: [number, number], placeName: string) => {
    if (!userLocation || !map.current || !apiKey) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${userLocation[0]},${userLocation[1]};${destination[0]},${destination[1]}?geometries=geojson&access_token=${apiKey}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = (route.distance / 1000).toFixed(2); // Convert to km
        const duration = Math.round(route.duration / 60); // Convert to minutes

        // Remove existing route layer if present
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }

        // Add route to map
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.75,
          },
        });

        // Add destination marker
        new mapboxgl.Marker({ color: '#10B981' })
          .setLngLat(destination)
          .setPopup(new mapboxgl.Popup().setHTML(`<h3>${placeName}</h3>`))
          .addTo(map.current);

        // Fit map to show entire route
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce(
          (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
            return bounds.extend(coord as [number, number]);
          },
          new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.current.fitBounds(bounds, { padding: 50 });

        setRouteInfo({ distance: `${distance} km`, duration: `${duration} min` });
        setShowResults(false);
        
        toast({
          title: "Route Calculated",
          description: `Distance: ${distance} km, Duration: ${duration} min`,
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast({
        title: "Route Error",
        description: "Failed to calculate route",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Auto-initialize if API key is already saved
    if (apiKey && !isMapReady) {
      initializeMap();
    }
    
    return () => {
      map.current?.remove();
    };
  }, []);
  
  // Update localStorage when API key changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('mapbox_api_key', apiKey);
    }
  }, [apiKey]);

  return (
    <div className="space-y-4">
      {!isMapReady && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label htmlFor="mapbox-api-key">Mapbox API Key</Label>
            <Input
              id="mapbox-api-key"
              type="text"
              placeholder="Enter your Mapbox public token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a
                href="https://mapbox.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                mapbox.com
              </a>
            </p>
          </div>
          <Button onClick={initializeMap} className="w-full">
            Load Map
          </Button>
        </div>
      )}

      <div className="relative w-full h-[500px] rounded-lg overflow-hidden border">
        <div ref={mapContainer} className="absolute inset-0" />
        
        {isMapReady && (
          <div className="absolute top-4 right-4 bg-background/95 backdrop-blur p-4 rounded-lg shadow-lg space-y-3 w-80">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPOI()}
                className="flex-1"
              />
              <Button onClick={searchPOI} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-muted cursor-pointer rounded text-sm"
                    onClick={() => {
                      calculateRoute(result.center, result.place_name);
                    }}
                  >
                    <div className="font-medium">{result.text}</div>
                    <div className="text-xs text-muted-foreground">{result.place_name}</div>
                  </div>
                ))}
              </div>
            )}

            {routeInfo && (
              <div className="flex items-center gap-2 text-sm bg-primary/10 p-2 rounded">
                <Navigation className="h-4 w-4" />
                <span>{routeInfo.distance} • {routeInfo.duration}</span>
              </div>
            )}
          </div>
        )}
        
        {isMapReady && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur p-3 rounded-lg shadow-lg space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
              <span className="text-sm">Your Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
              <span className="text-sm">NP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
              <span className="text-sm">EV Charger / Destination</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMap;
