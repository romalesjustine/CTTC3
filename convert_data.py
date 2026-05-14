import csv
import json

def convert_csv_to_json(csv_filepath, json_filepath):
    food_data = []
    
    # Changed encoding here from 'utf-8-sig' to 'cp1252' to handle Excel's special characters
    with open(csv_filepath, mode='r', encoding='cp1252') as csv_file:
        csv_reader = csv.DictReader(csv_file)
        for row in csv_reader:
            try:
                food_item = {
                    "name": row['Display_Name'].strip(),
                    "portion": f"{row['Portion_Amount']} {row['Portion_Display_Name'].strip()}",
                    "calories": float(row['Calories'])
                }
                food_data.append(food_item)
            except KeyError:
                continue
                
    # Save to JSON (Keep this as utf-8 so your web app reads it perfectly)
    with open(json_filepath, mode='w', encoding='utf-8') as json_file:
        json.dump(food_data, json_file, indent=2)
    
    print(f"Successfully converted {len(food_data)} records to {json_filepath}")

# Run the conversion
convert_csv_to_json('Food_Display_Table.csv', 'food_data.json')