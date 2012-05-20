all: uptodate
	cd potato && make doc
	cp -R potato/doc/* .
	git add -u
	
clean:
	rm -fr potato

potato:
	git clone https://github.com/poulejapon/potato.git potato

uptodate: potato
	cd potato && git pull

