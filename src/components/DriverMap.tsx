import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface DriverMapProps {
  onClose?: () => void;
}

const DriverMap: React.FC<DriverMapProps> = ({ onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const initializeMap = () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Mapbox API key to use the map",
        variant: "destructive",
      });
      return;
    }

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
          setIsMapReady(true);
        }
      );
    }
  };

  const searchNearbyPOIs = async (coords: [number, number]) => {
    if (!map.current) return;

    try {
      // Search for gas stations
      const gasResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/gas%20station.json?proximity=${coords[0]},${coords[1]}&limit=10&access_token=${apiKey}`
      );
      const gasData = await gasResponse.json();

      // Search for EV charging stations
      const evResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/ev%20charging%20station.json?proximity=${coords[0]},${coords[1]}&limit=10&access_token=${apiKey}`
      );
      const evData = await evResponse.json();

      // Add gas station markers
      gasData.features?.forEach((feature: any) => {
        const el = document.createElement('div');
        el.className = 'gas-station-marker';
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
              `<h3 style="font-weight: bold; margin-bottom: 4px;">⛽ Gas Station</h3>
               <p style="margin: 0;">${feature.place_name}</p>`
            )
          )
          .addTo(map.current!);
      });

      // Add EV charging station markers
      evData.features?.forEach((feature: any) => {
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

      toast({
        title: "Nearby Stations Loaded",
        description: `Found ${gasData.features?.length || 0} gas stations and ${evData.features?.length || 0} EV chargers`,
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

  useEffect(() => {
    return () => {
      map.current?.remove();
    };
  }, []);

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
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur p-3 rounded-lg shadow-lg space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
              <span className="text-sm">Your Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
              <span className="text-sm">Gas Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
              <span className="text-sm">EV Charger</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverMap;
