${build_path}/js/all.js: ${build_path}/external/LZWEncoder.js external/StackBlur.js ${build_path}/external/NeuQuant.js ${build_path}/external/GIFEncoder.js external/sketch.min.js ${build_path}/external/b64.js js/wiggle.js
	cat $^ > $@
