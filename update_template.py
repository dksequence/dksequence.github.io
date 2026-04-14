import base64
import os

img_path = r'e:\중문별장 work\001-web\runing\dk-runs\images\email_hero.jpg'
html_path = r'e:\중문별장 work\001-web\runing\dk-runs\email_template.html'

with open(img_path, 'rb') as f:
    b64_data = base64.b64encode(f.read()).decode('utf-8')

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Replace the placeholder with actual base64
new_html = html_content.replace('data:image/jpeg;base64,<?= imageBase64 ?>', f'data:image/jpeg;base64,{b64_data}')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print("HTML Template updated with Base64 image successfully.")
