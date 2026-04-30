import json
import os
import sys

# Set output to UTF-8 for Windows
sys.stdout.reconfigure(encoding='utf-8')

def extract_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    start_idx = content.find('[')
    end_idx = content.rfind(']')
    if start_idx == -1 or end_idx == -1:
        return None, None, None
    json_str = content[start_idx:end_idx+1]
    data = json.loads(json_str)
    return data, content[:start_idx], content[end_idx+1:]

def get_evidence(ai_path, attr_key):
    key_map = {
        'high_chair_available': [' child_seat available', 'child_seat available'],
        'kids_menu': ['Kids menu available'],
        'spacious_seating': ['Spacious seating'],
        'kid_noise_tolerant': ['kid_noise_tolerant']
    }
    
    if not os.path.exists(ai_path):
        return []
        
    try:
        with open(ai_path, 'r', encoding='utf-8') as f:
            ai_data = json.load(f)
            
        evidences = []
        possible_keys = key_map.get(attr_key, [])
        for pk in possible_keys:
            if pk in ai_data:
                res = ai_data[pk].get('result', '').upper()
                if res == 'YES':
                    ev = ai_data[pk].get('evidence')
                    if ev and isinstance(ev, str):
                        clean_ev = ev.strip()
                        if clean_ev.lower() not in ['null', 'none', 'unknown', 'n/a', 'na', '']:
                            evidences.append(clean_ev)
        return evidences
    except Exception as e:
        print(f'Error reading {ai_path}: {e}')
        return []

def main():
    data_file = 'data.js'
    ai_dir = 'ai_review'
    
    try:
        data, prefix, suffix = extract_json(data_file)
        if data is None:
            print('Failed to load data.js')
            return
            
        update_count = 0
        signal_added_count = 0
        
        for item in data:
            pid = item.get('place_id')
            if not pid:
                continue
                
            ai_path = os.path.join(ai_dir, f'{pid}.json')
            attributes = item.get('attributes', {})
            current_signals = item.get('signals', [])
            if current_signals is None:
                current_signals = []
                
            new_signals = []
            for attr, val in attributes.items():
                if val == 'yes':
                    evidences = get_evidence(ai_path, attr)
                    for ev in evidences:
                        if not any(ev in s or s in ev for s in current_signals + new_signals):
                            new_signals.append(ev)
            
            if new_signals:
                for s in new_signals:
                    if s not in current_signals:
                        current_signals.append(s)
                item['signals'] = current_signals
                update_count += 1
                signal_added_count += len(new_signals)
                
        with open(data_file, 'w', encoding='utf-8') as f:
            f.write(prefix)
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write(suffix)
            
        print(f'Updated {update_count} restaurants, added {signal_added_count} new signals.')
    except Exception as e:
        print(f"Main error: {e}")

if __name__ == '__main__':
    main()
