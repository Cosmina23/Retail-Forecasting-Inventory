export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

class LocationService {
  private baseUrl = 'https://nominatim.openstreetmap.org';

  async searchLocations(query: string): Promise<LocationSuggestion[]> {
    if (!query || query.length < 3) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': 'RetailForecastingApp/1.0', // Required by Nominatim
        },
      });

      if (!response.ok) {
        throw new Error('Location search failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Location search error:', error);
      return [];
    }
  }

  formatAddress(suggestion: LocationSuggestion): string {
    const parts = [];
    
    if (suggestion.address.road) {
      if (suggestion.address.house_number) {
        parts.push(`${suggestion.address.road} ${suggestion.address.house_number}`);
      } else {
        parts.push(suggestion.address.road);
      }
    }
    
    const city = suggestion.address.city || suggestion.address.town || suggestion.address.village;
    if (city) parts.push(city);
    
    if (suggestion.address.country) parts.push(suggestion.address.country);
    
    return parts.join(', ');
  }
}

export const locationService = new LocationService();
