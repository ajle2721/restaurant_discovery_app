import os

path = 'ai_review/index.js'
old_text = '"signals": "位於圖書館總館附近的日式料理，位置不多但坐起來很舒適，還有機器人送餐，價格也不會太貴，就點了丼飯跟一些菜來吃，丼飯還有送湯，飯是醋飯也不錯，握壽司大小剛好也沒有散掉，魚料理新鮮，醃製番番茄好吃，茶碗蒸可以當一點點湯喝，整體還不錯"'
new_text = '"signals": "位於圖書館總館附近的日式料理，位置不多但坐起來很舒適"'

if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if old_text in content:
        content = content.replace(old_text, new_text)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully updated ai_review/index.js")
    else:
        print("Could not find the target text in ai_review/index.js")
else:
    print("ai_review/index.js does not exist")
