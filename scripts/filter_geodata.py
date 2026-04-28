"""
Filter geodata/KAZ_OSM_BORDER_LVL3.shp to Abay Oblast districts
and write frontend/public/abay_districts.geojson.

Shapefile fields used:
  oblast_en  — oblast name in English ("Abay Region")
  name_en    — district name in English
  taldau     — district name in Russian (uppercase)
  osm_id     — OSM relation ID (used as district_id)
"""
import geopandas as gpd
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent.parent
SHP  = ROOT / "geodata" / "KAZ_OSM_BORDER_LVL3.shp"
OUT  = ROOT / "frontend" / "public" / "abay_districts.geojson"

# Known Abay Oblast districts and their canonical Russian names
# Keys match taldau field (uppercase Russian); values are display names
TALDAU_TO_NAME_RU = {
    "ЖАРМИНСКИЙ РАЙОН":    "Жарминский район",
    "АБАЙСКИЙ РАЙОН":      "Абайский район",
    "АЯГОЗСКИЙ РАЙОН":     "Аягозский район",
    "БЕСКАРАГАЙСКИЙ РАЙОН":"Бескарагайский район",
    "БОРОДУЛИХИНСКИЙ РАЙОН":"Бородулихинский район",
    "КОКПЕКТИНСКИЙ РАЙОН": "Кокпектинский район",
    "УРДЖАРСКИЙ РАЙОН":    "Урджарский район",
    "РАЙОН АҚСУАТ":        "Аксуатский район",
    "КУРЧАТОВ Г.А.":       "г. Курчатов",
    "СЕМЕЙ Г.А.":          "г. Семей",
    "РАЙОН ЖАҢАСЕМЕЙ":     "Жанасемейский район",
    "РАЙОН МАҚАНШЫ":       "Маканчинский район",
}

# Epidemiology file district names (for reference matching)
EPI_DISTRICT_NAMES = {
    "Жарминский район", "Абайский район", "Аксуатский район",
    "Аягозский район", "Бескарагайский район", "Бородулихинский район",
    "Кокпектинский район", "г. Курчатов", "Урджарский район", "г. Семей",
    "Жанасемейский район", "Маканчинский район",
}


def main():
    print(f"Reading {SHP}...")
    gdf = gpd.read_file(SHP)
    print(f"  Total features: {len(gdf)}")

    # Filter to Abay Region
    abay = gdf[gdf["oblast_en"] == "Abay Region"].copy()
    print(f"  Abay Region features: {len(abay)}")

    # Keep only the 10 known districts (by taldau key)
    abay = abay[abay["taldau"].isin(TALDAU_TO_NAME_RU)].copy()
    print(f"  After filtering to known 10 districts: {len(abay)}")

    # Map to output fields
    abay["district_id"] = "KAZ_" + abay["osm_id"].astype(str)
    abay["name_ru"] = abay["taldau"].map(TALDAU_TO_NAME_RU)
    abay["name_en"] = abay["name_en"]

    # Reproject to WGS84 if needed
    if abay.crs and abay.crs.to_epsg() != 4326:
        abay = abay.to_crs("EPSG:4326")

    # Keep only required columns
    out_gdf = abay[["district_id", "name_ru", "name_en", "geometry"]].copy()

    # Write GeoJSON
    out_gdf.to_file(str(OUT), driver="GeoJSON")

    # Verify output
    result = json.loads(OUT.read_text(encoding="utf-8"))
    names = [f["properties"]["name_ru"] for f in result["features"]]
    print(f"\nWrote {OUT}")
    print(f"Districts ({len(names)}):")
    for n in sorted(names):
        print(f"  {n}")

    missing = EPI_DISTRICT_NAMES - set(names)
    if missing:
        print(f"\nWARNING: these epi districts have no geometry: {missing}")
    else:
        print("\nAll epi districts matched.")


if __name__ == "__main__":
    main()
