import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Search, Navigation, MapPin, Loader2 } from "lucide-react";
import { useNPStations } from "@/hooks/useNPStations";
import { usePinnedLocations } from "@/hooks/usePinnedLocations";
import { supabase } from "@/integrations/supabase/client";

interface DriverMapProps {
  onClose?: () => void;
}

const DriverMap: React.FC<DriverMapProps> = ({ onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isPinMode, setIsPinMode] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [newPinLocation, setNewPinLocation] = useState<[number, number] | null>(null);
  const [pinName, setPinName] = useState('');
  const [pinDescription, setPinDescription] = useState('');
  const pinnedMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  const { data: npStations = [], isLoading: stationsLoading } = useNPStations();
  const { pinnedLocations, addPinnedLocation, deletePinnedLocation } = usePinnedLocations();

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setApiKey(data.token);
        } else {
          toast({
            title: "Configuration Error",
            description: "Mapbox token not configured. Please contact support.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        toast({
          title: "Error",
          description: "Failed to load map configuration",
          variant: "destructive",
        });
      } finally {
        setIsLoadingToken(false);
      }
    };

    fetchMapboxToken();
  }, []);

  const initializeMap = () => {
    if (!apiKey || !mapContainer.current) return;

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
    if (!map.current || stationsLoading || npStations.length === 0) return;

    npStations.forEach((station) => {
      const el = document.createElement('div');
      el.className = 'np-station-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#EF4444';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';

      new mapboxgl.Marker(el)
        .setLngLat([station.longitude, station.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3 style="font-weight: bold; margin-bottom: 4px;">⛽ ${station.name}</h3>
             ${station.address ? `<p style="margin: 4px 0; font-size: 12px;">${station.address}</p>` : ''}
             <button 
               onclick="window.calculateRouteToNP('${station.longitude}', '${station.latitude}', '${station.name}')"
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
      description: `${npStations.length} National Petroleum stations available`,
    });
  };

  const addPinnedLocationsToMap = () => {
    if (!map.current || !pinnedLocations || pinnedLocations.length === 0) return;

    // Clear existing pinned markers
    pinnedMarkersRef.current.forEach(marker => marker.remove());
    pinnedMarkersRef.current = [];

    pinnedLocations.forEach((location) => {
      const el = document.createElement('div');
      el.className = 'pinned-location-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#8B5CF6';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3 style="font-weight: bold; margin-bottom: 4px;">📍 ${location.name}</h3>
             ${location.description ? `<p style="margin: 4px 0; font-size: 12px;">${location.description}</p>` : ''}
             <div style="display: flex; gap: 4px; margin-top: 8px;">
               <button 
                 onclick="window.calculateRouteToPin('${location.longitude}', '${location.latitude}', '${location.name}')"
                 style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer; flex: 1;"
               >
                 Directions
               </button>
               <button 
                 onclick="window.deletePinnedLocation('${location.id}')"
                 style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;"
               >
                 Delete
               </button>
             </div>`
          )
        )
        .addTo(map.current!);

      pinnedMarkersRef.current.push(marker);
    });
  };

  const handleSavePin = () => {
    if (!newPinLocation || !pinName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the location",
        variant: "destructive",
      });
      return;
    }

    addPinnedLocation.mutate({
      name: pinName,
      description: pinDescription || undefined,
      latitude: newPinLocation[1],
      longitude: newPinLocation[0],
    });

    setShowPinDialog(false);
    setPinName('');
    setPinDescription('');
    setNewPinLocation(null);
  };

  // Make functions available globally for popup buttons
  useEffect(() => {
    (window as any).calculateRouteToNP = (lon: string, lat: string, name: string) => {
      calculateRoute([parseFloat(lon), parseFloat(lat)], name);
    };

    (window as any).calculateRouteToPin = (lon: string, lat: string, name: string) => {
      calculateRoute([parseFloat(lon), parseFloat(lat)], name);
    };

    (window as any).deletePinnedLocation = (id: string) => {
      deletePinnedLocation.mutate(id);
    };
    
    return () => {
      delete (window as any).calculateRouteToNP;
      delete (window as any).calculateRouteToPin;
      delete (window as any).deletePinnedLocation;
    };
  }, [userLocation, apiKey]);

  // Add NP stations when they're loaded and map is ready
  useEffect(() => {
    if (isMapReady && npStations.length > 0 && !stationsLoading) {
      addNPStations();
    }
  }, [isMapReady, npStations, stationsLoading]);

  // Add pinned locations when they're loaded and map is ready
  useEffect(() => {
    if (isMapReady && pinnedLocations) {
      addPinnedLocationsToMap();
    }
  }, [isMapReady, pinnedLocations]);

  // Handle map click for pin mode
  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (isPinMode) {
        setNewPinLocation([e.lngLat.lng, e.lngLat.lat]);
        setShowPinDialog(true);
        setIsPinMode(false);
      }
    };

    map.current.on('click', handleMapClick);

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [isPinMode]);

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

  // Auto-initialize when API key is loaded
  useEffect(() => {
    if (apiKey && !isMapReady) {
      initializeMap();
    }
    
    return () => {
      map.current?.remove();
    };
  }, [apiKey]);

  return (
    <div className="space-y-4">
      {isLoadingToken && (
        <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading map...</span>
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
              <Button 
                onClick={() => setIsPinMode(!isPinMode)} 
                size="icon"
                variant={isPinMode ? "default" : "outline"}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>

            {isPinMode && (
              <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded">
                Click anywhere on the map to pin a location
              </div>
            )}

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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white"></div>
              <span className="text-sm">My Pins</span>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pin Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pin-name">Location Name</Label>
              <Input
                id="pin-name"
                value={pinName}
                onChange={(e) => setPinName(e.target.value)}
                placeholder="e.g., Home, Office, Favorite Restaurant"
              />
            </div>
            <div>
              <Label htmlFor="pin-description">Description (Optional)</Label>
              <Textarea
                id="pin-description"
                value={pinDescription}
                onChange={(e) => setPinDescription(e.target.value)}
                placeholder="Add any notes about this location"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePin}>
              Save Pin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverMap;
