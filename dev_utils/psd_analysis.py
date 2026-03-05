from psd_tools import PSDImage
psd = PSDImage.open(r'C:\Users\paulj\WDweb\dev_utils\BelloMockup\mixed_7_003.psd')

def dump_layers(layers, indent=0):
   for layer in layers:
       print(f"{'  '*indent}{layer.kind}: '{layer.name}' | bbox={layer.bbox} | size={layer.size} | visible={layer.visible}")
       if hasattr(layer, 'smart_object'):
           so = layer.smart_object
           print(f"{'  '*(indent+1)}smart_object: filename={so.filename}, resolution={so.resolution}")
       if layer.is_group():
           dump_layers(layer, indent+1)

dump_layers(psd)
print(f"\nCanvas: {psd.width}x{psd.height}, mode={psd.color_mode}")