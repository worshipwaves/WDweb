from psd_tools import PSDImage

psd = PSDImage.open(r'C:\Users\paulj\WDweb\dev_utils\BelloMockup\mixed_7_003.psd')

for layer in psd:
    print(f"'{layer.name}' | blend_mode={layer.blend_mode} | opacity={layer.opacity}")
    if layer.is_group():
        for child in layer:
            print(f"  '{child.name}' | blend_mode={child.blend_mode} | opacity={child.opacity}")