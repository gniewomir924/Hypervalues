#!/usr/bin/env python3
"""
Trains the small network that guesses a stance for every value an ideology does not list, and writes completion_weights.js.

The network reads one ideology (its stances and which values it lists) and returns, for every value, the chance that the
ideology opposes it, does not list it, or supports it. It is trained without labels: some of the stances an ideology lists
are hidden from the input and the network has to give them back (a denoising autoencoder).

Run it again after changing stances or adding values:   python3 tools/train_completion.py
Needs numpy only. Reads ideology_scores.json and questions_tree.json, which must match data.js (node tools/check_scoring.js checks that).
"""
import base64, json, math, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIDDEN, STEPS, LEARNING_RATE, DECAY, UNLISTED_WEIGHT, BATCH, SEED = 128, 4000, 3e-3, 1e-3, 0.1, 48, 0

def fnv1a(text):                                   # the same 32-bit hash as tools/check_scoring.js
    h = 2166136261
    for byte in text.encode('utf-8'):
        h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
    return h

scores = json.load(open(os.path.join(ROOT, 'ideology_scores.json'), encoding='utf-8'))
labels = sorted(scores)
tree = json.load(open(os.path.join(ROOT, 'questions_tree.json'), encoding='utf-8'))
stance_values = {part.rsplit(':', 1)[0] for label in labels for part in scores[label]['s'].split('|') if part}
quiz_values = {node['id'] for nodes in tree.values() for node in nodes if 'options' not in node}
values = sorted(stance_values | quiz_values)
N, V = len(labels), len(values)
index = {value: i for i, value in enumerate(values)}
S = np.zeros((N, V))
for j, label in enumerate(labels):
    for part in scores[label]['s'].split('|'):
        if part:
            value, stance = part.rsplit(':', 1)
            S[j, index[value]] = float(stance)
L = (S != 0).astype(float)
trained_on = '%08x' % fnv1a('\n'.join(label + '\t' + scores[label]['s'] for label in labels))

rng = np.random.default_rng(SEED)
P = {'W1': rng.normal(0, math.sqrt(2 / (2 * V)), (2 * V, HIDDEN)), 'b1': np.zeros(HIDDEN),
     'W2': rng.normal(0, math.sqrt(1 / HIDDEN), (HIDDEN, 3 * V)), 'b2': np.zeros(3 * V)}
Y = np.stack([(S == 0), (S < 0), (S > 0)], -1).astype(float)   # classes: 0 not listed, 1 opposes, 2 supports

def forward(X):
    Z = X @ P['W1'] + P['b1']
    H = np.maximum(Z, 0)
    G = (H @ P['W2'] + P['b2']).reshape(len(X), V, 3)
    G = G - G.max(2, keepdims=True)
    E = np.exp(G)
    return Z, H, E / E.sum(2, keepdims=True)

m = {k: np.zeros_like(v) for k, v in P.items()}
v2 = {k: np.zeros_like(v) for k, v in P.items()}
for t in range(1, STEPS + 1):
    idx = rng.integers(0, N, BATCH)
    S0, L0 = S[idx], L[idx]
    hide = (rng.random((BATCH, V)) < rng.uniform(0.2, 0.5, (BATCH, 1))) & (L0 > 0)    # listed stances the input does not show
    keep = L0 * (~hide)
    X = np.concatenate([S0 * keep, keep], 1)
    weight = np.where(L0 == 0, UNLISTED_WEIGHT, np.where(hide, 1.0, 0.0))[..., None]
    Z, H, Pr = forward(X)
    dL = (weight * (Pr - Y[idx]) / max(weight.sum(), 1)).reshape(BATCH, 3 * V)
    dZ = (dL @ P['W2'].T) * (Z > 0)
    grad = {'W1': X.T @ dZ + DECAY * P['W1'], 'b1': dZ.sum(0), 'W2': H.T @ dL + DECAY * P['W2'], 'b2': dL.sum(0)}
    for k in P:
        m[k] = 0.9 * m[k] + 0.1 * grad[k]
        v2[k] = 0.999 * v2[k] + 0.001 * grad[k] ** 2
        P[k] -= LEARNING_RATE * (m[k] / (1 - 0.9 ** t)) / (np.sqrt(v2[k] / (1 - 0.999 ** t)) + 1e-8)

def pack(array):                                    # 16-bit integers with one scale per array, as base64
    scale = float(np.abs(array).max()) / 32767 or 1.0
    ints = np.round(array / scale).astype('<i2')
    return {'scale': scale, 'data': base64.b64encode(ints.tobytes()).decode('ascii')}, ints.astype(float) * scale

packed = {}
for k in P:
    packed[k], P[k] = pack(P[k])
_, _, Pr = forward(np.concatenate([S, L], 1))
unlisted = (S == 0)
print('ideologies %d, values %d, listed stances %d' % (N, V, int(L.sum())))
print('chance of supporting or opposing a value an ideology does not list: mean %.3f, above 0.2 for %.1f values per ideology'
      % ((1 - Pr[..., 0])[unlisted].mean(), ((1 - Pr[..., 0]) * unlisted > 0.2).sum() / N))
out = {'version': 1, 'hidden': HIDDEN, 'trainedOn': trained_on, 'ideologies': N, 'values': values, **packed}
with open(os.path.join(ROOT, 'completion_weights.js'), 'w', encoding='utf-8') as f:
    f.write('// Weights of the network that guesses stances for the values an ideology does not list.\n'
            '// Made by tools/train_completion.py from the stances in data.js - do not edit by hand.\n'
            'const COMPLETION = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print('wrote completion_weights.js (%.0f KB)' % (os.path.getsize(os.path.join(ROOT, 'completion_weights.js')) / 1024))
