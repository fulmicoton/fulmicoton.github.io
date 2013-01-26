all: readymade potato

rep/potato:
	git clone https://github.com/poulejapon/potato.git rep/potato

rep/readymade:
	git clone https://github.com/poulejapon/readymade.git rep/readymade

%: rep/%
	cd $< && npm install . && make build-doc
	cp -R $</doc $@

#uptodate: potato
#	cd rep && git pull

