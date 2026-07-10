import requests
from datetime import datetime, timedelta, timezone

def fetch_live_diesel_price() -> float:
    DEFAULT_DIESEL = 74.03 # The actual July 2026 Metro Manila average as a safe fallback
    
    try:
        # Replace this with the hidden JSON URL you found in the Network tab!
        api_url = "https://gaswatchph.com/api/community-prices" 
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        
        response = requests.get(api_url, headers=headers, timeout=5)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)

        if response.status_code == 200:
            data = response.json() 
            
            # 1. Isolate the list of stations
            stations = data.get("communityPrices", {})
            
            diesel_prices = []
            
            # 2. Loop through every station to find the diesel prices
            for station_id, fuels in stations.items():
                if "diesel" in fuels:
                    price = fuels["diesel"].get("price")
                    if price:
                        clean_price = float(price)
                        # Filter out trolls and typos (e.g., only accept prices between ₱50 and ₱95)
                        if 50.0 <= clean_price <= 95.0:
                            
                            # --- MISSING TIME DECAY FILTER ---
                            timestamp_str = fuels["diesel"].get("timestamp")
                            if timestamp_str:
                                # Convert the JSON string into a real Python datetime object
                                entry_date = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                                
                                # YOUR TURN: Add the 'if' statement here to check if entry_date is newer than cutoff_date!
                                # If it is, THEN you append it to the list:
                                # diesel_prices.append(clean_price)

                                if entry_date > cutoff_date:
                                    diesel_prices.append(clean_price)
                            
            
            # 3. Calculate the average if we found any prices
            if diesel_prices:
                average_price = sum(diesel_prices) / len(diesel_prices)
                return round(average_price, 2)
                
            return DEFAULT_DIESEL
        
    except Exception as e:
        print(f"⚠️ API Fetch failed: {e}. Defaulting to baseline.")
        return DEFAULT_DIESEL

if __name__ == "__main__":
    print("Fetching live prices from hidden API...")
    print(f"Result: ₱{fetch_live_diesel_price()}")