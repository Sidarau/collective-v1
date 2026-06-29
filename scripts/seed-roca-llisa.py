#!/usr/bin/env python3
"""Seed Roca Llisa villa, rooms, and existing bookings from the Excel sheet."""
import os, json, re, urllib.request
from datetime import datetime, timedelta
import pandas as pd

ENV_FILE = os.path.expanduser("~/.hermes/.env")
env = {}
with open(ENV_FILE) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:]
        if "=" in line:
            k, v = line.split("=", 1)
            env[k] = v

SUPABASE_URL = env.get("PROJECT_URL") or env.get("SUPABASE_URL")
SUPABASE_KEY = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")


def supabase_request(method: str, path: str, data=None):
    url = f"{SUPABASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("apikey", SUPABASE_KEY or "")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY or ''}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates")
    if data:
        req.data = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


XLSX = "/Users/alexsidarau/Downloads/Mastery Estate Ibiza - Monthly Villa Rentals 2026.xlsx"
SHEET = "Roca Llisa"

ROOM_TYPES = {
    "Barefoot Billionaire Suite": "suite",
    "Living my Best Life Room": "double",
    "Too Blessed to Stress Suite": "suite",
    "Soft Life Suite": "suite",
    "Manifestation Suite": "suite",
    "Jungle of Dreams Room": "double",
    "Wild Abundance Room": "double",
    "Moonlight Room": "double",
    "Delulu Palace": "master",
}

PLACEHOLDER_PRICES = {
    "Barefoot Billionaire Suite": 45000,
    "Living my Best Life Room": 32000,
    "Too Blessed to Stress Suite": 42000,
    "Soft Life Suite": 40000,
    "Manifestation Suite": 38000,
    "Jungle of Dreams Room": 30000,
    "Wild Abundance Room": 30000,
    "Moonlight Room": 28000,
    "Delulu Palace": 50000,
}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    df = pd.read_excel(XLSX, sheet_name=SHEET, header=0)
    df["Date"] = pd.to_datetime(df["Date"]).dt.date

    # 1. Create villa
    villa = {
        "name": "Roca Llisa",
        "slug": "roca-llisa",
        "location": "Ibiza, Spain",
        "description": "A private Mediterranean villa experience with 9 distinctive rooms.",
        "max_guests": 18,
        "amenities": ["Pool", "Sea views", "Garden", "Outdoor dining", "Concierge"],
    }
    villa_resp = supabase_request("POST", "/rest/v1/villas?on_conflict=slug", [villa])
    villa_id = villa_resp[0]["id"]
    print(f"Villa created/updated: {villa_id}")

    # 2. Create rooms
    room_cols = [c for c in df.columns if c not in ["Date", "Day", "Notes", "Total"] and not str(c).startswith("Unnamed")]
    room_ids = {}
    for room_name in room_cols:
        clean_name = room_name.strip()
        room = {
            "villa_id": villa_id,
            "name": clean_name,
            "slug": slugify(clean_name),
            "description": f"{clean_name} at Roca Llisa.",
            "room_type": ROOM_TYPES.get(clean_name, "double"),
            "max_guests": 2,
            "base_price_per_night": PLACEHOLDER_PRICES.get(clean_name, 30000),
            "currency": "EUR",
            "amenities": ["Ensuite bathroom", "Air conditioning", "WiFi"],
        }
        resp = supabase_request("POST", "/rest/v1/rooms?on_conflict=villa_id,slug", [room])
        room_ids[clean_name] = resp[0]["id"]
        print(f"Room created/updated: {clean_name} -> {resp[0]['id']}")

    # 3. Seed availability blocks from existing bookings
    for room_name in room_cols:
        clean_name = room_name.strip()
        room_id = room_ids[clean_name]
        col = df[["Date", room_name]].copy()
        col = col.sort_values("Date")

        current_guest = None
        current_start = None
        prev_date = None
        blocks = []

        for _, row in col.iterrows():
            date = row["Date"]
            guest = str(row[room_name]).strip() if pd.notna(row[room_name]) else None

            if guest and guest != current_guest:
                if current_guest:
                    blocks.append((current_guest, current_start, prev_date, room_id))
                current_guest = guest
                current_start = date
            elif not guest and current_guest:
                blocks.append((current_guest, current_start, prev_date, room_id))
                current_guest = None
                current_start = None
            prev_date = date

        if current_guest:
            blocks.append((current_guest, current_start, prev_date, room_id))

        for guest, start, end, room_id in blocks:
            lead_email = f"{slugify(guest)}@placeholder.local"
            lead = {
                "email": lead_email,
                "first_name": guest.split()[0] if guest.split() else guest,
                "last_name": " ".join(guest.split()[1:]) if len(guest.split()) > 1 else "Guest",
                "source": "excel-import",
                "status": "inactive",
            }
            lead_resp = supabase_request("POST", "/rest/v1/leads?on_conflict=email", [lead])
            lead_id = lead_resp[0]["id"]

            check_out = end + timedelta(days=1)
            booking = {
                "lead_id": lead_id,
                "room_id": room_id,
                "villa_id": villa_id,
                "check_in": str(start),
                "check_out": str(check_out),
                "guests": 1,
                "status": "confirmed",
                "total_price": 0,
                "currency": "EUR",
                "special_requests": f"Imported from Excel. Guest: {guest}",
            }
            booking_resp = supabase_request("POST", "/rest/v1/bookings", [booking])
            booking_id = booking_resp[0]["id"]

            availability = []
            d = start
            while d < check_out:
                availability.append({
                    "room_id": room_id,
                    "date": str(d),
                    "status": "booked",
                    "booking_id": booking_id,
                })
                d += timedelta(days=1)
            supabase_request("POST", "/rest/v1/availability_blocks", availability)
            print(f"  Booking: {guest} in {clean_name} from {start} to {check_out}")

    print("\nSeed complete!")


if __name__ == "__main__":
    main()
