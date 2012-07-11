all: readymade

rep/potato:
	git clone https://github.com/poulejapon/potato.git rep/potato

rep/readymade:
	git clone https://github.com/poulejapon/readymade.git rep/readymade

%: rep/%
	cd $< && make doc
	cp -R $</doc $@

#uptodate: potato
#	cd rep && git pull

