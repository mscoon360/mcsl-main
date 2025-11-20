import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Navigation } from "lucide-react";

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
            searchNearbyPOIs(defaultCoords);
          });
        }
      );
    }
  };

  const searchNearbyPOIs = async (coords: [number, number]) => {
    if (!map.current || !apiKey) return;

    try {
      const buildUrl = (query: string, useProximity: boolean) =>
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?limit=10&types=poi&access_token=${apiKey}` +
        (useProximity ? `&proximity=${coords[0]},${coords[1]}` : "");

      // Initial nearby search
      const [npResponse, evResponse] = await Promise.all([
        fetch(buildUrl("NP gas station", true)),
        fetch(buildUrl("ev charging station", true)),
      ]);

      let npData = await npResponse.json();
      let evData = await evResponse.json();

      // Fallback to broader search if nothing found nearby
      if (!npData.features || npData.features.length === 0) {
        const npFallback = await fetch(buildUrl("NP gas station", false));
        npData = await npFallback.json();
      }

      if (!evData.features || evData.features.length === 0) {
        const evFallback = await fetch(buildUrl("ev charging station", false));
        evData = await evFallback.json();
      }

      const npFeatures = npData.features || [];
      const evFeatures = evData.features || [];

      // Add NP markers
      npFeatures.forEach((feature: any) => {
        const el = document.createElement('div');
        el.className = 'np-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#EF4444';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';

        new mapboxgl.Marker(el)
          .setLngLat(feature.center)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<h3 style="font-weight: bold; margin-bottom: 4px;">📍 NP</h3>
               <p style="margin: 0;">${feature.place_name}</p>`
            )
          )
          .addTo(map.current!);
      });

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

      const npCount = npFeatures.length;
      const evCount = evFeatures.length;

      toast({
        title: npCount + evCount === 0 ? "No Locations Found" : "Nearby Locations Loaded",
        description:
          npCount + evCount === 0
            ? "No NP locations or EV chargers were found. Try zooming out or panning the map."
            : `Found ${npCount} NP locations and ${evCount} EV chargers`,
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
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?bbox=${ttBbox}&proximity=${userLocation?.[0] || -61.5432},${userLocation?.[1] || 10.6802}&limit=5&country=TT&access_token=${apiKey}`
      );
      const data = await response.json();
      setSearchResults(data.features || []);
      setShowResults(true);
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
