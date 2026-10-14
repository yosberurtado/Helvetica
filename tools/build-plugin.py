#!/usr/bin/env python3
"""Arma el plugin de WordPress (dist/casa-cuco-3d.zip) a partir de la web estática.

Uso: python3 tools/build-plugin.py

- Copia los archivos PHP de wordpress/casa-cuco-3d/.
- Copia css/, js/, vendor/three/ y assets/.
- Cambia los imports 'three' por rutas relativas, para no depender de un importmap
  (así no choca con otros scripts de WordPress).
- Extrae el <body> de index.html a templates/body.html.
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLUGIN = os.path.join(ROOT, 'wordpress', 'casa-cuco-3d')
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(DIST, 'casa-cuco-3d')


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(SRC_PLUGIN, OUT)
    shutil.copytree(os.path.join(ROOT, 'css'), os.path.join(OUT, 'css'))
    shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(OUT, 'assets'))

    # Three.js: los addons importan 'three'; se reemplaza por la ruta relativa al módulo principal.
    vendor_src = os.path.join(ROOT, 'vendor', 'three')
    vendor_out = os.path.join(OUT, 'vendor', 'three')
    shutil.copytree(vendor_src, vendor_out)
    for dirpath, _, files in os.walk(os.path.join(vendor_out, 'addons')):
        for name in files:
            if not name.endswith('.js'):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(os.path.join(vendor_out, 'three.module.min.js'), dirpath).replace(os.sep, '/')
            text = re.sub(r"from 'three'", f"from '{rel}'", read(path))
            write(path, text)

    main_js = read(os.path.join(ROOT, 'js', 'main.js'))
    main_js = main_js.replace("from 'three'", "from '../vendor/three/three.module.min.js'")
    main_js = main_js.replace("'three/addons/", "'../vendor/three/addons/")
    assert "from 'three" not in main_js, 'quedó un import sin resolver en main.js'
    write(os.path.join(OUT, 'js', 'main.js'), main_js)

    html = read(os.path.join(ROOT, 'index.html'))
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    body = re.sub(r'\s*<script type="module" src="js/main.js"></script>\s*', '\n', body)
    write(os.path.join(OUT, 'templates', 'body.html'), body.strip() + '\n')

    zip_path = os.path.join(DIST, 'casa-cuco-3d.zip')
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for dirpath, _, files in os.walk(OUT):
            for name in sorted(files):
                full = os.path.join(dirpath, name)
                z.write(full, os.path.relpath(full, DIST))
    print('Listo:', os.path.relpath(zip_path, ROOT), f'({os.path.getsize(zip_path) // 1024} KB)')


if __name__ == '__main__':
    main()
