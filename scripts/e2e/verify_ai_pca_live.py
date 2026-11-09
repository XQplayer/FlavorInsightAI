"""One bounded local Responses API check with a synthetic PCA excerpt.

Run with a private .env.local path and a synthetic prompt file. Neither the
credential nor the generated answer is printed; evidence stays gitignored.
This direct model probe does not verify HTTP authentication or production RLS.
"""

import json
import os
from pathlib import Path
import re
import sys

from services.ai_gateway import AIGateway, GatewayError
from services.ai_tools import Principal


def main(private_path: Path, prompt_path: Path, output_path: Path) -> int:
    allowed = {
        'OPENAI_API_KEY', 'OPENAI_MODEL', 'FLAVOR_AI_MODE',
        'FLAVOR_AI_ALLOW_LOCAL_REAL', 'FLAVOR_AI_INPUT_USD_PER_MILLION',
        'FLAVOR_AI_CACHED_INPUT_USD_PER_MILLION', 'FLAVOR_AI_OUTPUT_USD_PER_MILLION',
    }
    for raw in private_path.read_text(encoding='utf-8-sig').splitlines():
        line = raw.strip()
        if line and not line.startswith('#') and '=' in line:
            name, value = line.split('=', 1)
            if name in allowed:
                os.environ[name] = value.strip()
    os.environ['FLAVOR_AI_MAX_OUTPUT_TOKENS'] = '1500'
    prompt = prompt_path.read_text(encoding='utf-8')
    if '"synthetic":true' not in prompt or 'PCA_RESULT_EXCERPT=' not in prompt:
        raise ValueError('SYNTHETIC_PCA_EXCERPT_REQUIRED')
    gateway = AIGateway()
    if gateway.mode != 'openai' or not gateway.api_key or not gateway.model:
        raise ValueError('LIVE_MODEL_NOT_CONFIGURED')
    principal = Principal('synthetic-pca-local', guest=True)
    conversation = gateway.new_conversation(principal)
    try:
        events = list(gateway.chat(principal, conversation['id'], prompt))
        answer = ''.join(event.get('text', '') for event in events if event.get('type') == 'delta')
        usage = next((event for event in events if event.get('type') == 'usage'), {})
        record = {
            'status': 'PASS' if events and events[-1].get('type') == 'done' else 'INCOMPLETE',
            'synthetic': True,
            'mode': gateway.mode,
            'delta_count': sum(event.get('type') == 'delta' for event in events),
            'tool_names': [event.get('name') for event in events if event.get('type') == 'tool'],
            'input_tokens': usage.get('input_tokens'),
            'output_tokens': usage.get('output_tokens'),
            'estimated_cost_usd': usage.get('estimated_cost_usd'),
            'mentions_pca': 'PCA' in answer,
            'mentions_exploratory': bool(re.search('探索|描述性', answer)),
            'mentions_synthetic': bool(re.search('合成|synthetic', answer, re.I)),
            'asserted_p_value': bool(re.search(r'\bp\s*[<=>]\s*0?\.\d+', answer, re.I)),
            'answer': answer,
        }
    except GatewayError as exc:
        record = {'status': 'FAIL', 'error_code': exc.code, 'synthetic': True, 'mode': gateway.mode}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in record.items() if key != 'answer'}, ensure_ascii=False))
    return 0 if record['status'] == 'PASS' and record['mentions_pca'] and record['mentions_synthetic'] and not record['asserted_p_value'] else 1


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('usage: python -m scripts.e2e.verify_ai_pca_live PRIVATE_ENV SYNTHETIC_PROMPT IGNORED_OUTPUT')
    raise SystemExit(main(*(Path(arg) for arg in sys.argv[1:])))
