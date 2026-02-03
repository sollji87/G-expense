# -*- coding: utf-8 -*-
import json

def normalize_usage_text(text):
    lower = text.lower()
    
    # ChatGPT / GPT / OpenAI
    if 'chatgpt' in lower or 'chat gpt' in lower or 'gpt' in lower or 'openai' in lower:
        return 'ChatGPT/OpenAI'
    # Claude
    if 'claude' in lower:
        return 'Claude AI'
    # Cursor
    if 'cursor' in lower:
        return 'Cursor AI'
    # Copilot
    if 'copilot' in lower:
        return 'GitHub Copilot'
    # AWS
    if 'aws' in lower:
        return 'AWS'
    # GCP
    if 'gcp' in lower:
        return 'GCP'
    # Figma
    if 'figma' in lower:
        return 'Figma'
    # Slack
    if 'slack' in lower:
        return 'Slack'
    # M365
    if 'm365' in lower or ('ms' in lower and '365' in lower) or ('microsoft' in lower and '365' in lower):
        return 'MS 365'
    # Atlassian
    if 'atlassian' in lower or 'jira' in lower or 'confluence' in lower:
        return 'Atlassian'
    # Oracle
    if 'oracle' in lower:
        return 'Oracle'
    # Retool
    if 'retool' in lower:
        return 'Retool'
    # Miro
    if 'miro' in lower:
        return 'Miro'
    # 1Password
    if '1password' in lower:
        return '1Password'
    # Okta
    if 'okta' in lower:
        return 'Okta'
    # Salesforce
    if 'sfdc' in lower or 'salesforce' in lower:
        return 'Salesforce'
    # Jetbrains
    if 'jetbrain' in lower or 'pycharm' in lower:
        return 'JetBrains'
    # Github
    if 'github' in lower:
        return 'GitHub'
    # Postman
    if 'postman' in lower:
        return 'Postman'
    # PowerBI
    if 'powerbi' in lower or 'power bi' in lower:
        return 'Power BI'
    # Docusign
    if 'docusign' in lower:
        return 'DocuSign'
    # Tibco
    if 'tibco' in lower:
        return 'Tibco EAI'
    # Zoom
    if 'zoom' in lower:
        return 'Zoom'
    # Sentry
    if 'sentry' in lower:
        return 'Sentry'
    # Notion
    if 'notion' in lower:
        return 'Notion'
    # Adobe
    if 'adobe' in lower:
        return 'Adobe'
    # SAP
    if 'sap' in lower:
        return 'SAP'
        
    return text

with open('out/it_usage_details.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 정규화 테스트
normalized_counts = {}
for item in data.get('2025', []):
    norm = normalize_usage_text(item['text'])
    normalized_counts[norm] = normalized_counts.get(norm, 0) + 1

print("=== 정규화 결과 (상위 30개) ===")
for k, v in sorted(normalized_counts.items(), key=lambda x: -x[1])[:30]:
    print(f'{v:4d} | {k[:60]}')
