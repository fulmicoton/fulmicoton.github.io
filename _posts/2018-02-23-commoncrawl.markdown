---
layout: post
title: Of using Common Crawl to play Family Feud
category: posts
published: true
tags: commoncrawl, search, tantivy, rust
---

# Family feud meets Big Data

When I was working at Exalead, I had the chance to have access to a 16 billions pages search engine to play with. 
During a hackathon, I plugged together Exalead's search engine with a nifty python package called [`pattern`](https://www.clips.uantwerpen.be/pages/pattern),
and a word cloud generator.

[`Pattern`](https://www.clips.uantwerpen.be/pages/pattern) allows you to define phrase patterns and extract the text matching a specific placeholders.
I packaged it with a straightforward GUI and presented the demo as a big data driven family feud.

To answer a question like, **"Which adjectives are stereotypically associated with French people?"**, one would simply enter 

	French people are <adjective>

The app would run the phrase query `"French people are"` on the search engine, stream the results to a short python program that would then try and find adjectives coming right after the phrase. The app would then display the results as a world cloud as follows. 


I wondered how much it would cost me to try and reproduce this demo nowadays. 
Exalead is a company with hundreds of servers to back this search engine. Obviously I'm on a tighter budget.


![Tantivy]({{ "https://fulmicoton.com/tantivy-logo/tantivy-logo.png" }})

I happen to develop a search engine library in Rust called [tantivy](https://github.com/tantivy-search/tantivy). 
Indexing common-crawl would be a great way to test it, and a cool way to slap a well-deserved [sarcastic webscale label on it](https://www.youtube.com/watch?v=b2F-DItXtZs).

Well so far, I indexed a bit more than 25% of it, and indexing it entirely should cost me less than $400. Let me explain how I did it. If you are impatient, just scroll down, you'll be able to see colorful pictures, I promise.


# Common Crawl

[Common Crawl](http://commoncrawl.org/) is one of my favorite open datasets. It consists in 3.2 billions pages crawled from the 
web. Of course, 3 billions is far from exhaustive. The web contains hundreds of trillions of webpages, and most of it is unindexed. 

It would be interesting to compare this figure to recent search engines to give us some frame of reference.
Unfortunately Google and Bing are very secretive about the number of web pages they index.

We have some figure about the past:
In 2000, [Google reached its first billion indexed web pages](https://googleblog.blogspot.jp/2008/07/we-knew-web-was-big.html).
In 2012, [Yandex -the leading russian search engine- grew from 4 billions to tens of billions web pages](https://thenextweb.com/insider/2012/06/27/yandex-expands-global-search-index-from-4-billion-to-tens-of-billions-of-pages/).

> 3 billions pages indexed might have been enough to compete in the global search engine market in 2002. 

Nothing to sneeze as really.

The Common Crawl website [lists example projects](http://commoncrawl.org/the-data/examples/) . 
That kind of dataset is typically useful to mine for facts or linguistics. It can be helpful to train train a language model for instance, or try to create a list of companies in a specific industry for instance.

As far as I know, all of these projects are batching Common Crawl's data. Since it sits conveniently on Amazon S3, it is possible to grep through it with EC2 instances for [the price of a sandwich](https://engineeringblog.yelp.com/2015/03/analyzing-the-web-for-the-price-of-a-sandwich.html). 

As far as I know, nobody actually indexed Common Crawl so far. 
A opensource project called [Common Search](https://github.com/commonsearch) had the ambitious plan to make a public search engine out of it using elasticsearch. It seems inactive today unfortunately.
I would assume it lacked financial support to cover server costs. That kind of project would require a bare minimum of 40 server relatively high spec servers. 


# My initial plan and back of the envelope computations

Since the data is conveniently sitting on `Amazon S3` as part of [Amazon's public dataset program](https://aws.amazon.com/fr/public-datasets/), I naturally first considered indexing everything on `EC2`. 

Let's see how much that would have cost.

Since I focus on the documents containing English text, we can bring the 3.2 billions documents down to roughly 2.15 billions.

Common Crawl conveniently distributes so-called WET files that contains the text extracted from the HTML markup of the page.
The data is split into 80,000 WET files of roughly 115MB each, amounting overall to 9TB GZipped data, and somewhere around 17TB uncompressed.

We can shard our index into 80 shards including 1,000 WET files each.

To reproduce the family Feud demo, we will need to access the original text of the matched documents. For convenience, Tantivy makes this possible by defining our fields as *STORED* in our schema.

Tantivy's docstore compresses the data using LZ4 compression. After We typically get an inverse compression rate of 0.6 on natural language (by which I mean you compressed file is 60% the size of your original data).
The inverted index on the other hand, with positions, takes around 40% of the size of the uncompressed text. We should therefore expect our index, including the stored data, to be roughly equal to 17TB as well.

Indexing cost should not be an issue. Tantivy is already quite fast at indexing.
Indexing wikipedia (8GB) even with stemming enabled and including stored data typically takes around 10mn on my recently acquired Dell XPS 13 laptop.
We might want larger segments for Common-crawl, so maybe we should take a large margin and consider that a cheap t2.medium (2 vCPU) instance can index index 1GB of text in 3mn?
Our 17TB would require an overall 875 hours to index on instances that cost $0.05. The problem is extremely easy to distribute over 
80 instances, each of them in charge of 1000 WET files for instance. The whole operation should cost us less than 50 bucks. Not bad...

But where do we store this 17B index ? Should we upload all of these shards to S3. Then when we eventually want to query it, start many instances, have them download their respective set of shards and start up a search engine instance? That's sounds extremely expensive, and would require a very high start up time.

Interestingly, search engines are designed so that an individual query actually requires as litte IO as possible.
My initial plan was therefore to leave the index on `Amazon S3`, and query the data directly from there. Tantivy abstracts file accesses via a [`Directory`](https://tantivy-search.github.io/tantivy/tantivy/directory/trait.Directory.html) trait. Maybe it would be a good solution to have some kind of `S3` directory that downloads specific slices of files while queries are being run?
How would that go? 

The default dictionary in `tantivy` is based on a finite state transduce implementation : the excellent `fst` crate.
This is not ideal here, as accessing a key requires quite a few random accesses. When hitting S3, the cost of random accesses is magnified. We should expect 100ms of latency for each read. The API allows to ask for several ranges at once, 
but since we have no idea where the subsequent jumps will be, all of these reads will end up being sequential. Looking up a single keyword in our dictionary may end up taking close to a second.
Fortunately tantivy has an undocumented alternative dictionary format that should help us here.

Another problem is that files are accessed via a [`ReadOnlySource`](https://tantivy-search.github.io/tantivy/tantivy/directory/enum.ReadOnlySource.html) struct. 
Currently, the only real directory relies on `Mmap`, so throughout the code, tantivy relies heavily on the OS paging data for us, and liberally request for huge slices of data. We will therefore also need to go through all lines of code that access data, and only request the amount of data that is needed. Alternatively we could try and hack a solution around
[libsigsegv](https://www.gnu.org/software/libsigsegv/), but really this sounds dangerous, and might not be worth the artistic points.

Well, overall this sounds like a quite a bit of work, but which may result in valuable features for tantivy.

Oh by the way, what is the cost of simply storing this data in S3 ?

Well after checking the [Amazon S3 pricing details](https://aws.amazon.com/fr/s3/pricing/), just storing our 17TB data will cost us
around 400 USD per month. Ouch. Call me cheap... I know many people have more expensive hobbies but that's still too much money for me!

> The most important cost of indexing this on EC2/S3 would have been the storage of the index. Around 400 USD per month.

Back to the black board!


By the way, my estimates were not too far from reality.
I did not take in account the WET file headers, that ends up being thrown away. Also, some of the document which passed our English language detector
are multilingual. The tokenizer is configured to discard all tokens that do not contain exclusively characters in `[a-zA-Z0-9]`.

> In the end, one shard takes 165 GB, so the overall size of the index would te 13.2 TB. 


# Indexing Common Crawl for less than a dinner at a 2-star Michelin Restaurant  

What's great with back of the envelope computations is that they actually help you reconsider solutions that you unconsciously ruled out by "common sense". 
What about indexing the whole thing on my desktop computer... Downloading the whole thing using my private internet connnection. Is this ridiculous? 

Think about it, a 4TB hard drive nowadays on amazon Japan cost around 85 dollars. 
I could buy three or four of these and store the index there. 
The 8ms-10ms random seek latency will be actually much more comfortable than the S3 solution. 
That would cost me around $255, which is around the cost of dinner at a 2-star Michelin restaurant.

What about CPU time and download time ?
Well my internet connection seems to be able to download shards at a relatively stable 3MB/s to 4MB/s.
9TB will probably take 830 hours or 34 days. I can probably wait.
Once again, indexing at this speed is really not a problem. 

In fact, my bandwidth is only fast enough to keep two indexing threads busy, leaving me plenty of CPU to watch netflix and code. On my laptop, 1 thread would probably be ok.
Explicitely limiting the number of threads has the positive side effect of allocating more RAM to each segment being indexed. As a result, new segments produced are larger and less merging work is needed.

So I randomly partitioned the 80,000 WET files into 80 shards of 10,000 files each.
I then started indexing these shards sequentially. For each shard, after having indexed all documents, I force-merge all of the segments into a single very large segment. 


I'm not gonna lie to you. I haven't indexed Common-Crawl entirely yet. I only bought one 4TB hard disk, and indexed 21 shards (26%).
Indexing is in a iatus at this point, because I have been quite busy recently (see the personal news below). Shards are independent : the feasibility of indexing Common-Crawl entirely on one machine is proven at this point. Finishing the job is only a matter of throwing time and money.

# Resuming

I recently bought a house in Tokyo and the power installation was not too really suited with morning routine : dishwaser, heater and kettle was apparently too much and our fuses blew half of dozen of times.  

This was a very nice test for tantivy's ability to avoid data corruption and resume indexing under a a black out scenario.
In order to make it easier to keep track of the progress of indexing and resume from the right position, tantivy 0.5.0 now makes it possible to embed a small payload with every commit. For common-crawl, I commit after every 10 WET files. The payload is the last WET filename that got indexed.
 

# Reproducing it at home

On the off chance indexing Common-Crawl might interest businesses, academics or you,
I made the code I used to download and index common-crawl available [here](https://github.com/tantivy-search/tantivy-ccrawl).

The `README` file explains how to install and run the indexer part.
It's fairly well package.

You can then query each shard individually using [`tantivy-cli`](https://github.com/tantivy-search/tantivy-cli).

For instance, the search command will stream documents matching a given query.
You just need to pass it a shard directory and a query.
Its speed will be dominated limited by your IO, so if you have more than one disc, you can 
speed up the results by spreading shards over different shards and query them in parallel.

For instance, running the following command

	tantivy search -i my_index/shard_01 --query "\"I like\"" 

will output all the documents containing the phrase `"I like"`, in a json format, one document per-line, in no specific order.

# Demo time !

I wrote a small python script that reproduces the "family feud" demo. The script just outputs the data and the tag cloud are actually create manually on [wordclouds.com](https://www.wordclouds.com/) Here are a few results.

## The useful stuff

First, we can use this to understand stereotypes.

At Indeed, I had to work a lot with domain specific vocabulary.
Jobseeker might search for an `RN` or an `LVN` job for instance.
These acronyms were very obscure for me and other most non-native speakers.

If I search for `RN stands for`, I get the following results

	registered nurse
	retired nuisance
	staff badges
	registered nurses
	the series code
	registered nurse
	removable neck
	radon
	rn(i
	the input vector
	resort network
	certified nurses
	registered nut
	registered nurse
	registered nurse
	registered identification number
	registered nurse
	registered nurses

I got my answer: users searching for RN meant *registered nurse*.
For LVN, the results are similar :

	license occupation nurse
	registered nurse
	license occupation nurse
	license occupation nurse
	sorry
	license occupation nurse
	registered nurse
	the cause
	license occupation nurse
	licensed vocational nurse
	licensed vocational nursing
	license occupation nurse
	license occupation nurse
	license occupation nurse

LVN stands for *licensed vocational nurse*.

# Boostrapping dictionaries

It's often handy for prototyping to bootstrap rapidly a dictionary. For instance,
I might need rapidly a list of *job titles*. A fairly non-ambiguous pattern would be

	I work as a <noun phrase>

If I run this pattern on my index, I get these 5,000 unique jobtitles

<textarea style="height: 400px; overflow-y: visible">
model
tutor
nurse
teacher
physical therapist
freelancer
writer
graphic designer
consultant
registered nurse
designer
post-doc fellow
solo
movie location scout
freelance writer
software engineer
teaching assistant
photographer
librarian
nutritional consultant
paralegal
lawyer
manager
journalist
receptionist
translator
team
programmer
financial consultant
waitress
freelance reporter
cloud engineer
substitute teacher
freelance illustrator
freelance designer
scholar
computer programmer
web developer
software developer
pastor
background actor
freelance editor
freelance journalist
social worker
volunteer
secretary
scientist
school teacher
baker
barista
professional photographer
full time
nanny
concept artist
geology technician
cook
copywriter
researcher
cashier
virtual assistant
public health nurse
dance teacher
professional ski
full time tutor
cna
credit education consultant i
chef
copy editor
systems analyst
contractor
java developer
medical assistant
freelance photographer
caregiver
program manager
private mathematics
geologist
tour guide
school administrator
hospice chaplain
counselor
therapist
tech support
project manager
high school librarian
hr
freelance artist
bookkeeper
ranger
people development specialist
communication consultant
doctor
director
blogger
flight attendant
bartender
lunch lady
library assistant
stylist
captain
lecturer
freelance translator
freelance interior designer
freelance digital marketer
freelance author
visual artist
preschool teacher
freelance fashion stylist
nurse aide
graphic artist
chemo nurse
safety specialist
senior consultant
professional ilustrator
developer
train conduktor
counter and rental clerk
retail pharmacist
personal trainer
technical writer
senior python engineer
communications specialist
waiter
labor
psychologist
chemist
tax preparer
product designer
human resource specialist
finance manager
counsellor
computer systems analyst
sub editor
videographer
full time freelancer
career
university lecturer
mechanic
university professor
paraeducator
hospital chaplain
food/wine/travel photographer
server
professor
paramedic
newspaper distributor
freelance copyeditor
writer/editor
quality manager
program assistant
guide
research
model stitcher
trainer
coach
tech
solution architect
peer support specialist
pediatric oncology nurse
human resources representative
feature writer
fashion designer
psychotherapist
freelance interior
freelance graphic designer
correctional officer
marketing coordinator
supervisor
freelance web-developer
financial analyst
finance officer
critical care nurse
technician
team lead
teacher aide
mortgage broker
library technician
front-end web developer
creative designer
high school math
freelance information visualizer
support escalation engineer
student assistance program specialist
reporter
freelance professional sculptor
fitness trainer
business analyst
systems developer
producer
part time
management assistant
gardener
fireman
web designer
publisher
neighbourhood advocate
lifeguard
fundraiser/consultant
film technician
doula
consulting engineer
carpenter
bookseller
senior library assistant
security guard
sales rep
real estate agent
marketing assistant
tech arch manager
research assistant
nutritionist
medical laboratory assistant
medical doctor
massage therapist
handyman
critical care nurses
zoological field assistant
visual merchandiser
support worker
health
freelance trainer
dental hygienist
storyboard artist
sound engineer
registered architect
principal consultant
management consultant
gymnastics coach
full time actor
director general
database administrator
cartoonist
wildlife technician
web content
teller
technical illustrator
sccm engineer
rn
police officer
freelance digital marketing consultant
business advisor
biologist
video editor
team-lead
school
sales
research associate
pizza driver
lineman
dental assistant
customer service representative
school nurse
recruiter
photojournalist
medium
freelance sound technician
children
spanish interpreter
physician assistant
personal assistant
paginator
makeup artist
hairdresser
freelance theatre technician
dental asst
teachers aide
sports
retail assistant
rehab instructor
primary school teacher
pharmacist
pediatric nurse practitioner
medical transcriptionist
marketing communications manager
full-time writer
csr
chaplain
web admin
tv
survey taker
speech-language pathologist
software test engineer
social media manager
sleep educator
senior lecturer
sauce maker
publicist
product director
part time care assistant
ophthalmic technician
medical illustrator
marine biologist
illustrator
housing
customer service rep
campaign assistant
business consultant
webdesigner
system engineer
remedial paraprofessional
psychic , reiki master
professional statistician
product manager
part time housing counselor
mechanical engineer
manger
humanitarian worker
horticulturist
dermatologist
cosmetologist
civil servant
tv director
sales manager
mentor
housekeeper
freelance project manager
freelance copywriter
firefighter
dentist
writing mentor
web coder guy
vet tech
unit secretary
system analyst
system administrator
sysadmin
sr
reference librarian
reading
private chef
part time tour guide
painter
freelance ebook writer
fin
debt counselor
travel consultant
student assistant
spiritual counselor
projectionist
professional content writer
product reviewer
principal road designer
partner
part time decorator
network engineer
infrastructure engineer
high school teacher
gp
freelance contractor
enterprise solutions architect
dog trainer
digital marketer
development manager
creative head
controller
civil engineer
case manager
barista i
accounting
technology
surveyor
special education assistant
secondary teacher
school counselor
research scientist
postdoc
mother
lifestyle photographer
legal secretary
kindergartenteacher
java developer/architect
front-end developer
freelance digital business coach
computer technician
client support manager
clerk
chief science officer
6th grade teacher
women
technical director
ta
systems engineer
senior software engineer
senior designer
senior concept artist
professional artist
physiotherapist
pharmacy technician
person
part-time events safety steward
paramedic and i love gaming
nurse practitioner
naturalist
museum teacher i stockholm
linux system engineer
graphic designer/web designer
freelance virtual assistant
digital designer
design engineer
design director
dental nurse
buyer
business development manager
zoologist
web author
video games programmer
telecommunications engineer
stripper
staff accountant
software architect
senior research engineer
research horticulturist
property manager
professional cook
pastry chef
part time water garden consultant
part time art teacher
math-teacher
marketing manager
janitor
heavy duty truck mechanic
freelance seo
fishing guide
field
dog groomer
digital strategy consultant
digital marketing consultant
construction worker
carer
cake decorator
book slave
beautician
a radiographer
911 dispatcher/telecommunicator
writing tutor
veterinarian
title-one tutor
technical architect
systems administrator
street fundraiser
staff nurse
software consultant
software
self
quality control inspector
production assistant
private tutor
nursing assistant
musical director
music teacher
multimedia journalist
math teacher
management level systems architect
make-up artist
library technology trainer
legal assistant
hospital pharmacist
harmony animator
hairstylist
general contractor
freelance harpist
florist
fisherman
esthetician
email responder
driver
dj
dispatcher
data analyst
cto
credit manager
countryside ranger
costume-designer
corrections officer
communication officer
clinical liaison
veterinary assistant
travel agent
telecom/network architect
substitute
student
specialist
scripter
science writer
school psychologist
school librarian
photo model
pharmacy tech
pa
nurse part
millwright
medical secretary
medical receptionist
mathematical statistician
hostess
homemaker
full time artist
freelance makeup artist
freelance court reporter
financial advisor
feng shui consultant
cycling coach
creative director
contact centre manager full-time
community manager
clinical psychologist
cardiologist
wedding coordinator
website designer
visual designer
user experience designer
train driver
tester
temp
support engineer
spin
special education teacher
somm
software engineering manager
software development consultant
senior software developer
senior design researcher
senior customer service manager
senior citrix administrator
senior backend developer
seismic tester
secondary school teacher
salesman
ruby developer
professional writer
professional actor
principal lecturer
planning manager
physician
php developer
pediatric icu doctor
nail technician
monitor
member
live
leader
intensive care nurse
hair stylist
full-time dental assistant
freelance web developer
freelance make-up artist
freelance costume maker
freelance climate
freelance business analyst
engineer
clown
character designer
butcher
beauty therapist
babysitter
youth
yoga instructor
veterinary technician
veterinary nurse
ux designer
unix developer
trader
team leader
teacher assistant
story artist
steel erector/scaffolder
staff writer
ski instructor
sharepoint
sexuality
senior manager
security officer
screenwriter
science teacher
rural mail carrier associate
public servant
public defender
professional visual effects artist
product manager/business analyst
planning analyst
pilot
network administrator
musician
motivational speaker
medical examiner
medical biller
mediator
media designer
maid
machinist
lumberjack
kindergarten teacher
home appraiser
hockey player
headhunter
graphics designer
game director
game designer
fundraiser
full-time cta
freelance musician
financial risk manager
field engineer
field biologist
fashion
family doctor
facilitator
design manager
deputy sheriff
delivery driver
dancer
cost accountant
cop
content writer
character artist
camp counselor
bouncer
biology lab technician
writer/pr guy
web dev
venture capitalist
truck driver
traffic controller
town clerk
technology consultant
speech therapist
social media strategist
security
seamstress
sales representative
registrar
realtor
ra
psychiatrist
proofreader
professional tutor
professional sideman
professional ecologist
principal architect
pastry
part-time pet stylist
panoramic photographer
nursery nurse
newspaper reporter
network
midwife
middle
marketing representative
maintenance tech
lutheran hospital priest
locum emergency physician
language teacher
interior designer
hotel butler
health coach
gyno doctor
guitar teacher
general secretary
general osteopath
full time illustrator
french teacher
floral designer
film location scout
farmhand
farmer
faculty
dog sitter
docent
digital nomad
content manager
construction engineer
conservationist
clinical supervisor
cleaner
carpenter/craftsman
bookkeeper/office manager
bank manager
3d environment artist
welder
webmaster
web
trauma
telemarketer
tefl teacher
technology lead
teacher ’
tattoo artist
tail guide
systems architect
surgical nurse
supply teacher
sub-editor
sonographer
solicitor
software tester
service tech
senior level software engineer
security consultant
sales analyst
retail manager
prostitute
professional developer
product photographer
product marketing manager
process engineer
postdoctoral researcher
post-doc
personal chef
pediatric icu nurse
pca house keeper
pca
payroll specialist
music producer
mom
mobile specialist
ministry assistant
medic
mechanical designer
marketing specialist
marketing consultant
marketing
marine ecologist
manufacturing engineer
line service tech
lead
layout/pre-press/graphic artist
lab assistant
kind
guidance counselor
guard
graphics artist
fulltime nanny
full-time freelancer
full time mechanic
freelance web designer
freelance graphic artist
foreign exchange trader
fitness instructor
film director
fashion consultant
dropout prevention counselor
digital intern
diesel mechanic
dialysis nurse
data entry operator
custodian
cpa
courier
coordinator
content marketer
content editor
construction electrician
concierge
computer tech
computer scientist
computer consultant
compliance analyst
cocktail bartender
cloud solutions architect
clinician
cinematographer
chinese-english interpreter/translator
child
charge nurse
chalet chef
certified nursing assistant
call center agent
weekend package
wedding photographer
website developer
web programmer
web editor
wardrobe stylist/assistant
voice actor
virtual infrastructure administrator
video news photographer
typist
tv sports anchor
truck-driver
test engineer
techsupport
technology facilitator
technical consultant
sys admin
sub
strategist
store manager
special assistant
sound technician
solutions architect
soloist
sole trader
software solutions architect
singer-songwriter
short order cook/clerk/waitress/janitor/whatever
shop assistant
senior portrait photographer
second grade teacher
scribe
screen printer
scientific and regulatory specialist
sales consultant
robotics engineer
rn parttime
respiratory therapist
resident assistant
research analyst
rental manager
recruitment officer
recruitment consultant
radio host
quantum physics researcher
public relation officer
proofreader/copyeditor
project leader
project coordinator
proffesional dj
professional software developer
private investigator
private eye
private english tutor
principal
pr
post-doctoral researcher
phd student
part time writer
part time software developer
part
paraprofessional
para
nurses aid
night guard
nanny part time
middle school teacher
meteorologist
mestiza cook
merchandiser
member services analyst
medical supervisor
marketer
man nurse
maintenance worker
life guard
life coach
library clerk
library aide
lexicographic editor
leadership
lash stylist
laboratory technician
knowledge management specialist
ios developer
hot tar roofer
high school
healer
head conservator
government contractor
gm marketing
glass technician
ghostwriter
geomatic technician
freelance new media producer
freelance health
free lance artist painting
flash animator
filmmaker
field instructor
district nurse
digital marketing manager
dice dealer
devops engineer
decoratvie
data scientist
data developer
curator
ct/mri technologist
creative writing teacher
copy writer
community
business
busboy
builder
bricklayer
bike mechanic
baler operator
asst
yoga teacher
weekend chef
webprogrammer
voice
vlsi chip designer
verification engineer
tv editor
trumpet teacher
trade publication editor
ticket agent
technology manager
teaching artist
taxi driver
system architect
subcontractor
student ambassador
store clerk
steward
statistician
sports event coordinator
speech pathologist
special projects advisor
spanish teacher
songwriter
software dev
social worker aid
slave
senior programmer
senior marketing executive
senior editor
senior developer
security systems
security specialist
sculptor
salesperson
sales account manager
robotics software
resource teacher
research coordinator
representative
rep
relief teacher
rehabilitation specialist
real estate paralegal
quality technician
quality engineer
qualified english teacher
public school teacher
professional translator
professional model
professional commercial photographer
production
private security specialist
private agronomist
primary teacher
postdoctoral fellow
portrait
plumber
play-by-play announcer
pilot biologist
personal shopper
personal banker
pension benefits analyst
pediatrician
pediatric nurse
payroll clerk
part-time wedding videographer
parking enforcement officer
p.
nurse ’
news production assistant
news anchor
network technician
motion designer
minister
middle school math teacher
meter reader
messenger
mental health therapist
medical office manager
medical language specialist
meat cutter
mathematics teacher
masseuse
marketing director
magician
machine
locksmith
live bookie
liquor
line cook
library page
landscape designer
laboratory engineer
insurance salesman
hypnotherapist
hotel bartender
host
hospice nurse
home security specialist
home health aide
home
healthcare giver
health researcher
hardware engineer
hall director
hair dresser
grant writer
graduate assistant
glass artist
ghost
general practitioner
freelance videographer
freelance television camera operator
freelance designer/illustrator
freelance content writer
freelance content creator
freelance consultant
freelance composer
free-lance architect/designer
free lancer
framer
food photographer
fluid dynamics engineer
fish biologist
fire investigator
fire fighter
file clerk/archivist
figure model
field technician
fashion stylist
dog trainer´s assistant
dishwasher
digital illustrator
development officer
dealer
dba
data engineer
customer rep
cpo
corporate travel counsellor
corporate trainer
cookbook publicist
content lead
community support worker
community nurse
communications
commercial diver
college professor
clinical research nurse
cleaning lady
child abuse prevention educator
chief
certified school counselor
cashier/grocery/dairy/and deli clerk
career counselor
care aide
cancer co-ordinator
cable television technician
c
business coach
broker
bridal consultant
blast investigation expert
bike courier
barmaid
banker
bank teller
background painter
youth worker
youth librarian
yields researcher
writer/reporter
writer cake decorator
wire man
web-programmer
web writer
web strategy consultant
web content manager
web application engineer
waitress part time
video producer
video
vet
vendor manager
unit manager
tv journalist
travel
transportation planner
transport officer
transaction broker
training consultant
trainee
tpi fitness
tourleader
tourist guide
third party language interpreter
theoretical physicist
textile designer
testing designer
technical trainer
technical support engineer
tech support agent
tech sthupport/customer
tech lead
tax analyst
system
sw engineer
surgical technologist
surgeon
support technician
structural engineer
strength
stem ambassador
standard user
stagehand
staff
spanish translator
spanish language instructor
sound designer
software development manager
shopmanager
shopkeeper
shift supervisor
shadow
service technician
service designer
service
server software engineer
servant
senior systems administrator
senior payroll administrator
senior digital strategist
senior analyst
seller
self-development consultant
select role
secondary drama teacher
scuba instructor
salesgirl
sales man
sales executive
sales clerk
sales agent
safety officer
roast master
roadside tech
river guide
reviewer
retoucher
research physicist
research nurse
research engineer
research compliance officer
research chemist
reporter—i set
repair technician
relief worker
regular interviewer
recreation therapist
reader
rape crisis counselor
radiographer
r&d engineer
public speaker
public relations
public librarian
pt
psychic medium
psychiatric nurse
psych nurse
promo director
project engineer
programmer part-time
program coordinator
professional musician
professional marketing specialist
professional illustrator
professional graphic designer
professional genealogist
professional book designer
production manager
production designer
production artist
process manager
probation officer
private teacher
private medical secretary
presenter
practice manager
pra
pr consultant
port-a-john mopper
pizza delivery man
pi
physics teacher
physical therapy tech
physical therapy assistant
phlebotomist
personal fitness trainer
personal finance coach
personal coach
pct
part timer
part time transcriber
part time teacher
part time sports photographer
part time nanny
part time adjunct professor
park ranger
office asst
novelist
news reporter
news editor
network analyst
nail tech
multimedia designer
mortgage planner
moderator
mobile massage therapist
mobile and desktop+raspberry pi software developer
minion
microsoft sharepoint sme
microsoft crm consultant
mental health counselor
medical writer
medical transcriber
medical laboratory technologist
mechanical design engineer
mechanical and electrical designer
master
marketing/public relations consultant
marketing executive
manicure master
manager we
madwomen
machine operator
lifeguard/swim instructor
life celebrant
licensed massage therapist
liaison
lead pastor
lead developer
language assistant
land surveyor
laboratory manger
kintsugi artist
jr
journalist my wife
jewelry designer
jeweller
incident
home tutor
home health nurse
home business entrepreneur
heavy equipment operator
heavy equipment mechanic
health care assistant
head
hands-on healer
hand engraver
greeter
graphic designer/illustrator
graduate research assistant
graduate engineer
graduate
grade
government contract administrator
global librarian
german teacher
geo
general manager
games artist
game programmer
game developer
game artist
fund-raising consultant
full-time nanny
full-time copywriter
full time surgeon
full time paramedic
full time nurse
full time nanny
full time engineer
front end developer
freelancer designer
freelance story artist
freelance social media manager
freelance network analyst
freelance model
freelance interpreter
freelance examiner
freelance director
freelance developer
freelance art pa/assistant
freelance animator
forensic dna analyst
foreman
fitness model
fish
fine artist
financial manager
finance
film editor
filing clerk
federal contractor
farm labourer
family aide
dynamics
drudge
drafter
domestic help
dog walker
distributor
direct support worker
development engineer
designer/seamstress
design consultant
design
dental technician
decorator
dean
day laborer
data specialist
data entry
data analytics person
customer service agent
customer service
critical thinking
credit analyst
creative recruiter
creative art photography support assistant
correspondent
corporate lawyer
content developer
consultant cardiologist
construction manager
construction engineering inspector
computer geek
compliance officer
communications assistant
communication specialist
communication manager
comic artist
code wrangler
cocktail waitress
co-director
cnc machinist
closer/funder
clinical social worker
clinical pharmacist
clinical manager
chiropractor
childminder
chief financial executive
chemical engineer
cg animator
care assistant
campus recruiter
campaigner
campaign
cameraman
cabinetmaker
c.
business manager
building engjneer
broadcast engineer
brand strategist
bounser
book editor
biochemist
bicycle mechanic
behavior therapist
beauty consultant
barrister
bank clerk
band
bacp
backend developer
automotive technician
automotive designer
auto tech
assistant
animator
administrator
accountant
911 operator
3d engine/tools/etc programmer
3d artist
youth pastor
youth minister
youth councelor
writing coach
wraparound
worship leader
workforce management planner
work
wordpress specialist
wine sales consultant
windows/linux specialist
wildlife biologist
wildland firefighter
wilderness guide
whole
welder/ fabricator
webdeveloper
webcam model
web marketer
web content editor
web analyst
wastewater treatment plant operator
ward sister
vj
visual facilitator
visual effects
vfx
vet assistant
venture
vendor
vegetarian chef
valet
va
ux/ui designer
ux contractor
ux consultant
user experience specialist
unix system/web development specialist
unit clerk
unit
union stills photographer
union carpenter
ub-cit consultant
two-person team
tv-producer
tv news reporter
turbine engineer
treavle
treadmill coach
travel nurse
trasher
transparent partner
translator/interpreter
translation specialist
translation assistant
transaltor italian
training coordinator
traditional illustrator/creator
tradesman
tow truck driver
tour leader
tour guide i
tool
toddler teacher
ticket office clerk
textbook editor
territory sales manager
television editor
telemetry nurse
telecom
technology analyst
technical/professional writer
technical translator
technical support representative
technical lead
technical evangelist
technical editor
technical artist
technical analyst
tech writer
team player
team member
team coordinator
teacher-librarian
taxonomist
talent agent
t.
systems manager
systems integrator
system integrator
sysadmin/technician
sydney
swimsuit model
surgery manager
support chef
support
supplier
superintendent
successful model
subtitler
sub contractor
stylist it
student worker
student supervisor
student counselor
structural drafer
stringer
strategic procurement specialist
store-man
stocker
stand
stage hand
staffing specialist
staff member
staff attorney
spiritual advisor
speechwriter
special needs
special education secretary
special education paraprofessional
space pirate
sous chef
solution center consultant
solution architect/specialist
solo response
solo pianist/vocalist
solo librarian
soldier
software analyst
social studies teacher
social studies specialist
social researcher
social media specialist
social media coordinator
social media consultant
social media
snowboard instructor
small team
ski patroller
site manager
site
singing teacher
shop-assistant
sheet metal worker
sharing economy lifestyle blogger
seta contractor
set decorator
service supervisor
service provider
service management consultant
service engineer
service advisor
serious injury consultant
senior web developer
senior technician
senior scientist
senior researcher
senior habilitation provider
senior director
senior digital designer
senior concept designer
senior art director
senior analyst programmer
senior accountant
semi-professional musician
self-employed graphic designer
self-employed artist
security supervisor
security analyst
secretary d.
secratary
script reader
scientific researcher
science tutor
science technician
schoolteacher
school secretary
school bus driver
salon manager
salesmanager
sales floor guy
sales administrator
salary employee
salaried w2 employee
sailing instructor
safety engineer
safety
rural health educator
roofer
risk manager
revenue inspector
restorative aide
restaurant server
resource
resort receptionist
resident
reservation
research it specialist
research fellow
research doctor
replacement work
relational and existential therapist
registered veterinary nurse
registered nurse bsn
registered dental assistant
reference
referee
recreation
record producer
reactor operator
radiologist
quality controller
quality control point
quality control
quality assurance engineer
purrsonal assistant
purchasing co-ordinator
public engagement officer
public affairs officer
pt church secretary
pt aide
psw
pse
protestant minister
prosecutor
promoter
project supervisor
project consultant
project co-ordinator
project administrator
program director
professional video editor
professional urdu translator
professional story artist
professional magician
professional graphic designer/illustrator
professional freelance writer
professional editor
professional coach
professional chef
professional archaeologist
professional and academic coach
professional actress
professional 3d artist
production accountant
product development engineer
product developer
private oboe instructor
private independent physiotherapist
private home school teacher
print designer
principal member
primry teacher
primary
president
preschool teacher ’
premier field engineer
pre-k teacher
practice development lawyer
practical theologian
pr manager
potter
post-doc researcher
portrait photographer
porter
policy advisor
policeman
police
plm consultant
planner
piano teacher
physical trainer
physical therapist assistant
photographic and visual historian
photographer/videographer
photo editor
phone sex operator
performance artist
peer tutor
peer mentor
peer educator
pediatric oncology rn
pedagogic worker
pc technician
pc tech
payroll manager
patternmaker
patient care assistant
patient advocate
pastry artist
parts clerk
part-time waitress
part-time tour guide
part-time security guy
part-time math tutor
part-time maid
part-time interpreter
part-time baby
part time pro
part time phlebotomist
part time job
part time event planner
par-time clerk
pair
paid surveyor
paid consultant
p/t
one-man data
nursing aid
nursery tech
nurse tech
nurse specialist
nurse case manager
nurse assistant
nuclear pharmacy technician
nuclear equipment operator
notary
normal writer
nightclub dj
night-time taxi driver
night security guard
night auditor
newspaper columnist
new registered nurse
neonatal nurse
n.
musicotherapist
music video director
music minister
music director
museum attendant
movie theater manager
mover
motion picture camera assistant
motion graphics designer
mobile¹ mobile²
mobile notary public
mobile developer
missionary and international aid worker
miscarriage
minicab driver
milliner
military psychologist
military contractor
microbiologist
mental health peer specialist
mental health
medical nurse
medical laboratory technician
medical interpreter
medical editor
medical affairs
media supervisor
maths coach
math tutor
martial artist
marriage
marketing intern
marketing guy
marketing associate
marketing analyst
management representative
management accountant
male nurse
magazine editor
lot
long term volunteer
logo designer
logistics manager
logestics tech
locum
local realtor
local newspaper photographer
loan officer
live engineer
literacy coach
linux system administrator
linux server systems administrator
line editor
lighting technician
light technician
lieutenant
learning specialist
lead archives technician
language editor
landscaper
landscape
laboratory assistant
lab technician
lab monitor
lab manager
lab instructor
lab
kitchen porter
kitchen assistant
kindergarden teacher
kids
kennel assistant
kayak guide
junior executive
jungian analyst
judge
jazz player
japanese translator
jailer
jack
itt trainer
it analyst
individual
humorist
human resources assistant
housing advice officer
housemanager
hospitalist
hospital
horse caretaker
horse
homeopath
home health aid
home care aide
holistic therapist
hlta
history teacher
high
helper
healthcare attorney
health physicist
health expert
health educator
health benefits specialist
head hunter
handy man
hair
guest teacher
guest blogger
graphic ui designer
graduate student
government contractor it
global marketing manager
gis analyst
general practice manager
games journalist
game purchaser
gallery technician
ga
full-time realtor
full-time photographer
full-time english
full-time digital marketer
full-time artist
full timer
full time teacher
full time software engineer
full time school librarian
full time realtor
full time microstock photographer
full time lecturer
full time firefighter
full time employee
full time chef
full time artist/tattooer
full time analyst
full stack developer
ft pro
front desk rep
freelancer videomaker
freelancer spending my
freelance webdesigner
freelance teaching artist
freelance social media expert
freelance rental agent
freelance programmer
freelance print
freelance personal trainer
freelance personal stylist
freelance oboist
freelance layout sub-editor
freelance front-end developer
freelance exhibition stand design
freelance engineer
freelance employee
freelance database administrator
freelance casting agent
freelance bookkeeper
freelance blogger
free-lance pianist
forklift driver
forestry advisor
forester
floor painter
fitter
fish wholesaler
financial services expert
financial represenative
financial planner
financial adviser
finance contractor
finance analyst
final expense agent
film
feldenkrais teacher
federal field archaeologist
federal employee
fashion model
family therapist
family lawyer
family law attorney
family
faculty member
fabricator
executive assistant
electrician
economist
dvd qc technician
dumptruck driver
drug
drilling technologist
drilling engineer
draftsman
dp
doorman
door knocker
dominatrix
dog bather
documentary film editor
dive instructor
disability transportation specialist
director/ designer
diplomat
digital marketing strategist
digital marketer executive
digital marketeer
dietary aide
diesel technician
developer i
developer advocate
desktop publisher
deputy
department manager
delphi dev
defense contractor
debt collector
data entry clerk
dancer/bodywork practitioner
cybersecurity engineer
customer services manager
customer service manager
customer
custom picture framer
crisis counsellor
criminal lawyer
crime scene photographer
creator
creative writer
creative consultant
couple
countryside warden
counseling psychologist
costume designer
corporate wellness consultant
corporate recruiter
cook-server-bartender
convenience store clerk
contributor
contracts administrator
contract fire fighter
content strategist
content provider
content assistant
contemporary dancer
consultant musculoskeletal radiologist
consultant ecologist
construction inspector
conductor
concert producer
concept designer
computer repair tech
computer operator
computer lab
computer installation technician
computer
composer
company secretary
companionship facilitator
communicator
communications planner
communications analyst
commercial photographer
commercial interior designer
columnist
college recruiter
cognitive behavioural therapist
coder
cns
cm
club promoter part-time
clinical laboratory scientist
classroom assistant
clapham
clairvoyant medium
church
choreographer
chinese teacher
childcare provider
chief technician
chief marketing officer
chief financial officer
chief engineer
chha
chartered accountant
channel
certified nursing aid
certified deaf interpreter
central supply
caterer
cataloger
casual laborer
casting director
carryout
caricaturist
caricature artist
caretaker
career firefighter
career councilor
career advisor
care worker
care provider
care giver
candidate/political opponent i
cad/cam designer
buyer ’
business intelligence
business developer
bus driver
building operator
broadcast journalist
brick layer
brian c.
bottle water
border patrol agent
bookings coordinator
book illustrator
book designer
bond enforcement agent
boily
body worker
bitcoin miner
birthday party coordinator
birth doula
birth
bilingual e/j tech translator
bike tech
behavioural therapist
behavior/habilitative interventionist working
bathroom fitter
bathroom attendant
bartender/server
barman
barista full time tuesday
bar tender
bank cashier
ballet trainee teacher
background artist
back-end developer
back office
baby sitter
audio technician
assistant professor
applied researcher
agent
academic tutor
academic superstar
911 telecommunicator
3d generalist
…
‘ lunch lady ’
zookeeper
youtuber
youth educator
youth director
youth counselor
youth advisor
young people
young business owner
yoga therapist
year
yardmaster
ya librarian
xylitol educator
xxxx xxxx
xxxx
xx teacher
writing specialist
writing fellow
writing coach/tutor
writing coach teacher
writing center tutor
writer/producer
writer/photographer
writer/director/producer/editor/animator
write
worship
worldview consultant
workman
workamper
wordpress consultant
worcester county divorce
woodworker my passion
wireline engineer
wireless engineer
wipe
winemaker
wine tour guide
wine journalist
wine
windsurfing instructor
windows systems administrator
window dresser
window
wildlife tour guide
wildlife cameraman
wildlife artist
wide area comms/internal it/desktop support tech
wholesaler
whisky guide
wellness coach
welder/blacksmith
weekday team member
wedding stationer
wedding planner
wedding
webtoon artist
website developer/designer
website coordinator
webdev
web-developer
web worker
web ui designer
web staffer
web publisher
web producer
web pedagog
web marketing specialist
web marketing analyst
web marketing advisor
web marketing
web developer/programmer
web developer/designer
web designer/programmer
web designer/developer
web designer she
web architect
web applications developer
web application specialist
web application programmer
web application developer
web application
web analytics program manager
weaver
way
watershed practitioner
waterfowl technician
water microbiologist
watchman
washing machine repair man
warehouse supervisor
warehouse foreman
wardrobe stylist
wakeboarding coach
waitress/bartender
waiteress
waiter part time
waiter dekat satu cafe area kursk
wage slave
voting member
volunteer web designer
volunteer tutor
volunteer soccer/basketball/softball coach
volunteer shelver
volunteer school board attorney
volunteer reader
volunteer pa
volunteer museum guide
volunteer helper
volunteer guide
volunteer firefighter
volunteer editor
volunteer counselor
volunteer counsellor
volunteer chaplain
volunteer ambassador
volunteer adult literacy tutor
voluntary worker
voluntary coach
voluntary art tutor
volkswagen tech
voice-over artiste
voice teacher
voice coach
vodafone dealer
vocational rehabilitation specialist
vocal teacher
vocal coach
visualising
visual field technician
visual effects artist
visual development
visitor experience associate
virtualization consultant
virtual teacher
virtual hr support assistant
virtual cfo
violin teacher
vintage hair
vintage bus driver
village trustee part time
vigilante group member
vietnamese tutor
videogames programming teacher
video game store
video game producer
video content producer
video blogger
victim witness
vicar
vfx supervisor
veteran
vehicle transporter
vehicle mechanic
vehicle emissions tester
vegetation ecologist
vegan chef
vector
vb
van driver
uxui designer
ux/ui mobile designer
ux lead
utility meter reader
user researcher
user interface engineer
user interface
user experience researcher
user experience
usability consultant
us
urology nurse
urban planner
unix system engineer
unix sysadmin
unix administrator
unix
university instructor
university grade software developer
university chaplain
united states census employee
unit supervisor
unit secretay
union electrician
union boilermaker
ui engineer
ui developer
ui designer
ui
typing machine
typesetter
tv talent
tv script writer
tv producer
tv presenter
tv news producer
tv news anchor/lineup editor
tv cameraman
tv analyst
tuk tuk driver
tss
trustee
trusted adviser
truck unloader
truck driver/warehouseman
trial attorney
tree faller
traveler
travel rn
travel publicist
travel photojournalist
travel agency
travel adviser
trauma nurse
trashy translator
transpricing consultant
transporter
transport industry trainer
transport driver
transport coordinator
translator/linguist
translator myself
translator i
translator german/english
translator english <-> urdu
transcriptionist part-time
transcriptionist
transcription quality controller
transcriber
transalator
transaction agent
training specialist i
training development director
trainer/content developer
trainer/consultant
trainee student
trainee purchaser
trainee bass teacher
trainee actuary
train guard
train
trails guide
trail crew member
traffic/billing director
traffic cop
traditional nonprofit consultant
tradeswoman
trademark paralegal
trade union official
trade manager
trade compliance specialist
tractor-trailer driver
toy designer
toxicologist
tourist
tourism photographer
tourism consultant
tourguide
tour-guide
topless waiter
tooth
tool designer
tl
tire tech
tiger team member
tier-1 technician
ticket seller
ticket
thief
these pastries
therapy dog
therapy aide
therapists
therapeutic support staff
therapeutic counsellor
theologian
theme wrangler
theatre nurse
theatre
theater critic
theater artist
theater
textiles sales rep
textile artist/illustrator
textile artist
textil worker
texas rancher
testing engineer
testing coordinator
test/automation engineer
test technician
test coordinator
terrain park ranger
terminal assistant
tenure track professor
tennis coach
temporary worker
temporary lecturer
temporary lab technician
temporary employee
temple worker
temp employee
television production manager
television director/scriptwriter
telephone repairman
telephone counsellor
telemetry assistant
telegraph officer
telecom expense management domain
teenager
teen librarian
technology writer
technology lawyer
technology investor
technology evangelist
technology enthusiast
technology coordinator
technologist
techno functional consultant
technician-programmer
technician ’
technicial manager
technical system administrator
technical support rep
technical support agent
technical support advisor
technical staff
technical services veterinarian
technical recruiter
technical project manager
technical producer
technical officer
technical instructor
technical drawer
technical diving instructor
technical content writer
technical author
technical assistant
technical account manager
tech service chemist
tech operator
tech integration specialist
tech guy
teatcher
teapot package designer
team you
team lead engineering
teaching/ research assistant
teaching staff
teaching assitant
teaching aid
teaching
teachers
teacherlect
teacher/manager
teacher/football coach
teacher/assistant
teacher working
teacher teaching
teacher spending
teacher part-time
teacher myself
teacher librarian
teacher aid
tea lady one day
tea boy
tc
taxidermyst
tax preparer part time
tax lawyer
tax consultant
tax advisor
tax accountant
tax
tattoomodel
tattooist
tarot reader
target warehouse member
tanner
talento
talent scout
talent manager
tailoress
systems/network engineer
systems software engineer
systems security engineer
systems
system operator
system developer consultant
system designer
system admin
sysadmin/head
sysad
sys administrator
sys
switchboard operator
swimming instructor
sw engr myself
sushi chef
survey supervisor assistant
survey interviewer
survey engineer
surgical vet tech
surgical technician
surgical tech
surgical fnp rnfa
surgical coord
surgery
surg
surf instructor
support staff
support specialist
support officer
supply sgt
supply manager
superviser
supermarket cashier
superior bikes marketing person
super-model
summer employee
summer counseler
summer associate
successful angel therapist™
subtitute teacher
substitute/on-call cashier
substitute teacher,do i
substitute teacher part-time
substitute p.
substance abuse counselor
subsitute teacher
submissions editor
submarine pilot
subject matter
style coach
stuntman
study career coach
studio arts educator
studio artist
studio
student-aid
student travel agent
student team manager
student teacher
student programmer
student library assistant
student intern
student guidance councellor
student greenskeeper
student aide
structural consultant
striptease dancer
street doctor
street counselor
strategy consultant/pm
strategy consultant
strategic digital marketing specialist
strategic adviser
stranger
stove promoter
storyteller
storeman
store accounting coordinator
store
storage systems administrator
stockroom guy
stockbroker
stock control
stitcher
stipend volunteer
stewardess
stenographer
stem teacher
steel worker
steel fabricator
steamfitter
stay-at-home mommy
stay-at-home mom
stay
stationery
start referee
start orientation leader
stand-in
stampin
stage manager
staffing coordinator
staff writer/editor
staff technician
staff systems engineer
staff photographer
staff lead
staff engineer
staff editor
staff assistant
staff artist
staff accoutant
stable manager
sr-associate
sr principle software engineer
squash centre manager
sql server administrator
sql database administrator
sprint team member
spotlight operator
sports teacher
sports reporter
sports photography stringer
sports photographer
sports performance coach
sports editor
sports coach
spokesman
spirituality/love coach/energy healer
spiritual/life/relationship coach
spiritual-healer
spiritual life coach
spiritual director
spiritual counselor offering sessions
spiritual care provider
speech/language pathologist
speech language pathologist
speech
specification manager
specialized assassin
specialist technician
specialist product photographer
special projects coordinator
special nurse
special needs resource consultant
special force candidate
special educator
special education para
special education
special ed.
special clerk
speaker coach i
speaker
spanish language interpreter
soundengineer and/or producer
sound tech engineer
sound tech
sound system engineer
sound editor
sound director/boom
soul retriever
solution manager
solution designer analyst
solo wedding photographer
solo photographer
solo performer
solo artist/star
solo artist
solo act
sole practitioner
sole operator
soil consultant
software support
software programmer
software guru
software executive
software enginer
software engineer andi
software development team leader
software development lead
software development engineer
software development director
software developer/application support engineer
software designer
soft dev btw
social worker/mental health counselor
social service work
social scientist
social media/marketing
social media team leader
social media person
social media manager/children
social media expert
social media assistant
social media ambassador
social managment network
social justice educator
soccer coach
socail worker
snowboard tour guide
snake handler
smm
smith
smart repairer
small time contractor
small engine technician
small business internet marketing consultant
small business consultant
small animal internist
sm @ pier1 imports
slp
slot attendant
skin therapist
skill game developer
ski mechanic
ski guide
ski coach
sketch artist
site supervisor
site hostess
single point
single mom
singing waitress
singer/ songwriter
singer
simple teacher
sign painter
sign language interpreter
sign language
sign holder
sideman
sideing installer
short order cook
shop-assistance
shitty generalist
ships fitter/ welder
shipping supervisor
shipping manager myself
shipper/receiver
shipper
shipelectroniks installer
shipbuilding engineer
shepherd
shelf stocker
sheet metal
sharepoint it
sharepoint developer
shampoo boy
shaman
sexual and reproductive health advisor
sexton
set dresser
sessional lobbyist
session musician
session leader
servicedesk analyst
service technician i
service tech/electronics repairman
service girl
service development engineer
service delivery manager
service coordinator
servant leader
serious orgy fest
sergeant
seo manager
seo freelancer
seo engineer
seo consultant
sensory research specialist
senior wordpress engineer
senior user experience designer
senior treasury analyst
senior testing specialist
senior teller
senior technical recruiter
senior technical analyst
senior systems/software engineer
senior systems engineer
senior system engineer
senior sysadmin
senior support worker
senior subeditor
senior sql server dba
senior software architect
senior server team engineer
senior search engineer
senior rov pilot
senior reservoir geologist
senior property accountant
senior program manager
senior product security engineer
senior portfolio developer
senior policy advisor
senior oceans campaigner
senior member
senior loan officer
senior litigation counsel
senior lead
senior laser engineer
senior java/j2ee developer
senior infrastructure consultant
senior home companion
senior high school teacher
senior helpdesk consultant
senior graphic designer
senior game artist
senior executive
senior engineer
senior electronics
senior economist
senior ecm consultant
senior designations officer
senior design engineer
senior dba
senior database developer
senior data scientist
senior copywriter
senior consultant specialising
senior concept
senior communications strategist
senior communications officer
senior commercial advisor
senior civil engineer
senior auditor
senior architect
senior application support analyst
senior admissions counselor
senior administrator
senior account manager
semiotician
semi-professional short-order cook
semester-to-semester employee
selling team
seller-consultant
self-trained nutritionist
self-published manga artist
self-employed tutor
self-employed translator
self-employed sub-contractor
self-employed specialist
self-employed registered dietitian
self-employed real estate broker
self-employed housekeeper
self-employed freelance web designer
self-employed fiction editor
self-employed cyclist
self-advocate
self help coach
sekretary
seduction
security worker
security officer working
security office
security network administrator
security manager
security inspector
security guard i
security gaurd
security administrator
secretary/personal assistant
secretary/middleman
secretary i
secretary general
secret shopper
secret agent
secret
secreatary
seafood clerk
sdet engineer
scuba
scrummaster
scripty
scriptwriter
screening officer
screener
scout
scientific project manager
scientific officer
science/chemistry teacher
science visualizer
science policy officer
science journalist
science editor
science communicator
science communication
science
school teacher i
school programs facilitator
school principal/teacher
school nurse we
school manager
school inspector
school home liaison
school custodian
school community resource specialist
school careers advisor
schoo/outdoor
scheme manager
scenic artist
saxophone player
santa
sandwich maker
saleswomen-consultant
saleswoman
salesman underwear
saleslady
sales/marketing officer
sales trainer
sales lady
sales engineer
sales department supervisor
sales associate
sale girl
sailor
safari tour guide
s.
russian tutor
russian teacher
russian escort
rural middle school
runwaymodel
runway model
runner
rule
rubbish web designer
routesetter
route-setter
route salesperson
room assistant
roofing salesman
roof
rollercoaster designer
roadside assistant
road designer
rmn
river biologist
ritzy investment banker
risk analyst
right size customer support
rib master
reviser
reviewer/proofreader
reverse engineer
revenue manager
revenue data clerk
retro-tainer
retained–search recruiter
retained firefighter
retail wireless consultant
retail supervisor
retail superviser
retail sales clerk
retail sales
retail experience specialist
retail customer service manager
retail cashier
retail accountant
resuscitation officer
restorer
restoration artist
restaurant manger
restaurant hostess
restaurant critic
restaurant accountant
resource specialist
resource room teacher
resource person
resource management officer
residential teacher
residential real estate appraiser
residential property consultant
residential counselor
residential appraiser
resident physician
resident manager
resident director
resident astronomer
resident advisor
reservoir engineer
reserve emt…
research technican
research specialist
research scholar
research historian
research assistant working
research assistant i
research administrator
reseacher
reporting
report,it ’
rentals manager
renovation specialist
removal occupation
remote-developer
remote teacher
remote medical officer
remote computer tech
remote cad operator
relief chef
relief advocate
release manager
release engineer
relationship counsellor
relationship coach
relate counsellor
rehabilitation counselor
regulatory associate
regulatory affairs assistant
regulator
regular english
registered respiratory therapist
registered nurse we
registered medical assistant
registered manager
registered clinical counsellor
regional workforce policy advisor
regional network administrator
regional manager sales(team
regional finance manager
regional director
refuge support worker
reflector
referral coordinator @ shands
redactor
recruitment manager
recruitment co-ordinator
recruitment
recruiter part time
recreational therapist
recreation programmer
recreation coordinator
recovery coach
recording studio assistant
recording
record mixer
recommendation
recess aide
receptionists
receptionist/secretary
receptionist/hall monitor
reception manager
recepcionist
realtor par-time
really good team
real np
real estate team
real estate investor
real estate investment analyst
real estate consultant
real estate broker
real estate appraiser
reader/note-taker
range officer
random old hairdresser
ranch hand
railway section hand
railroad
rail traffic controller
rail guide
raido promoter
raft guide
radiology supervisor
radio reporter
radio operator
radio journalist/newsreader
radio engineer
radio dj
radio d.
radio anchorperson
radiation therapist
racehorse trainer
race driver
ra/
r&d
quantity surveyor
quantitative user experience researcher
quantitative portfolio manager
quantitative analyst
quality control manager
quality contol data
quality checker
quality assurance specialist
quality assurance analyst day
quality analyst
quality
qualified biomechanist
qs cadet
qae
qa person
qa lead
qa graphic/layout designer
qa engineer
qa automation lead
qa analyst
python programmer
python developer
pyp hrt
pychologist
purchasing clerk
purchase
punching bag
pump consultant
publishing/writing consultant
public school bus driver
public safety officer
public relations manager
public purchasing agent
public hospital psychiatrist
public health registrar
public affairs specialist
public adjuster
pt officer
psychosocial counselor
psychology teacher
psychologist…
psychological counselor
psychodynamic therapist
psychodynamic psychotherapist
psychiatry resident
psychiatric social worker
psychiatric nurse practitioner
psych rn
pss
provider relations manager
protector
protection officer
prorammer
proposal writer
property manager myself
property developer
proofreader/editor
proofreader/copy-editor
proof-reader
promotora
promotional model
promo personnel
projet lea
project officer
project manger
project management consultant
project lead
project engineer/cost analyst
project director
project assistant
project architect
project admin
programmer/analyst
programmer today
programme officer
programme director
program support assistant
program manager/ instructor
program evaluator
program analyst/mission planning specialist/foreign liaison
program analyst
program
professionnal
professional wedding photographer
professional web developer
professional web designer
professional tour director
professional theatre director
professional tarot card reader
professional stylist
professional stripper
professional storyteller
professional software architect
professional snowboarder
professional seo
professional sculptor
professional psychic astologer
professional private guide
professional pianist
professional officer
professional nyc state electrologist
professional npc
professional musician i wish guitar pro
professional mixer
professional mediator
professional makeup artist
professional make-up artist
professional magician/mindreader
professional librarian
professional killer
professional interpreter
professional ifmga mountain guide
professional hairdresser
professional guitarist/vocalist
professional guide
professional gardener
professional game developer
professional fund manager
professional freelancing musician
professional firefighter/emt
professional filmmaker
professional fashion designer
professional family
professional environmentalist
professional english translator
professional educator
professional earth mover tire installer
professional driver
professional domme
professional dog masseur
professional designer
professional dancer
professional counselor
professional copywriter
professional consultant
professional computer programmer
professional communicator
professional cleaner
professional business coach
professional blogger
professional barber
professional backup/recovery sysadmin
professional author
professional animal communicator
professional aero engineer
profession photographer
profesional firefighter
prof
production supervisor
production sound mixer
production rigger
production dba
production coordinator
product tester
product specialist
product safety
product rep
product owner
product intern
product development manager
product design
product copywriter
product coordinator
product
producer/composer
procurer
procurement manager
procurement consultant
proctor
processor
process technician
problem solver
pro-grammer
pro-domme
pro house cleaner
pro fight judge
prn
privet
private writing coach
private trainer
private tour guide
private system administrator
private security officer
private practitioner
private practioner
private practice ibclc
private english teacher
private educational consultant
private duty nurse
private driver
private drive
private construction company
privatdozent
prison librarian
printer buy day
printer
principal imaging systems engineer
principal advisor
principal accounts officer
princess
primary school teacher teaching science
primary school teacher i ’ ve
primary school lsa
primary school librarian
primary instructor
primary care physician
priest
pride guide
pricing analyst
prevention specialist
pretty much voluntary moderator
press snapper
press officer
presidential ambassador
preschool teacher trainer
preschool teacher assistant
preschool substitute
presales solutions architect
preprimary teacher
prep cook
premises manager
preemie nurse
pre-school teacher
pre-sales consultant software
pre-op transsexual
pragensis journalist
practicing attorney
practice nurse
practical nurse
pr executive
pr director
powertrain
powerful team
power plant operator
power engineer
postman
postgresql dba
postdoctoral research associate
postal worker
postal service workman
postal carrier
post-doctoral clinical-health psychology researcher
post-audio engineer
post-anaesthetic nurse
post production runner
post doc researcher
post
possibility strategist
portrait artist
poll clerk
politician
political sociologist
political researcher
political consultant
polish/english translator/interpreter
policy officer
policy adviser
police/fire
police sergeant
police constable
police community engagement officer
police chaplain
pole dance
pol sci professor
poker tournament director
poetry-teacher member
poet
podiatrist
pm
plummer
playwright
playworker
playleader
playground monitor
player
plastic surgeon
plastic injection tool designer
plant breeder
planning engineer
planning director
planning
pj
pizza delivery man part time
pizza delivery driver
pizza delivery boy
pirate
pipeliner
pipeline system controller
pipefitter
pinterest consultant
piercer
picture editor
pick
pianist
pi paralegal
physiotherapists
physiotherapist alot
physio
physician living
physician liaison
physican assistant
physical therapy
physical educations teacher
physical education teacher
physical education
physiatrist
php programmer
photoshop web designer
photography technician
photography lecturer
photographic process workers
photographer/photo editor
photographer/editor
photographer/designer
photographer i concentrate
photo organizer
photo assistant
photo
phone english teacher
philosophical practitioner
phd-student/researcher
pharmacy technician trainee
pharmaceutical doctor
pharamcy tech
pf pm manager
petition-writer
pet stylist
pet sitter
pet nurse
pet groomer
personla trainer
personal tutor
personal training director
personal trainer/fitness instructor
personal trainer myself
personal support worker
personal support care giver
personal shopping assistant
personal rn
personal meditation coach
personal caregiver
personal care aide
person-centred counsellor
permanent substitute teacher
permanent researcher
perinatal nurse
peri operative tech
performance
perfectionist
peon
pen-tester
peer support worker
peer counselor
peer advisor
pee collector
pedicabber
pediatric speech-language pathologist
pediatric pt
pediatric physical therapist
pediatric oncologist
pediatric occupational therapist
pediatric home care nurse
pediatric hh lpn
pedagogical assistant
peace
pe teacher
pd dispatcher
pca/homemaker
pc/network technician
pc/network administrator
pc technician/network administrator full-time
pc tech cleaning
pc operator
payroll worker
payroll apprentice
payroll admin
pattern designer
patrol officer
patrol division deputy sheriff
patrol
patients
patient-churning
patient transporter
patient educator
patient education director
patient coordinator
patient companion
patient care technician
patient
pathfinder
patent writer
patent attorney
patent
pastry baker
party manager
party host
parttime
parts guy
partnerships locality officer
partner solution consultant
partner manager
partner driver
partime job
part-timer
part-time yoga teacher
part-time xxx
part-time worker
part-time wardrobe consultant
part-time volunteer i
part-time student
part-time software developer
part-time sales assistant
part-time sales
part-time research associate
part-time professor
part-time pastor
part-time nurse
part-time news editor
part-time nanny
part-time lifeguard
part-time library aide
part-time graphic designer
part-time game developer
part-time gallery manager
part-time french high-school teacher
part-time employee
part-time electrician
part-time doula
part-time contractor
part-time consultant
part-time cfo
part-time beauty artist/advisor
part-time assistant teacher
part-time assignment writer
part-time administrative assistant
part-time admin assistant
part time volunteer
part time vet
part time tutor
part time support worker
part time self
part time sales supervisor
part time relexologist
part time prof
part time police officer
part time nurse
part time lingerie
part time lifeguard
part time library ninja
part time instructor
part time illustrator
part time housekeeper
part time guardian
part time freelancer
part time fiction editor
part time engineer
part time consultant
part time circus coach
part time blogger
part time bartender
part time assistant
part ii
part i
parole officer
parliamentary assistant
parish
paraprofessional indexer
paramedic right
paramedic i
paramedic and i love it
para-librarian
para-educator
par time
paper-pusher
paper pusher
paper maker
painter,cam-girl,auctioneer,animal volunteer,lobbyist,petition writer
pain-nurse
pain consultant
page
paediatric nusre
padi instructor
padi dive instructor
pacs applications system specialist
packer
overnight charge nurse
orthodontist technican
optometric tech
operating manager
openstack solutions architect
online tutor
online marketer
one-woman crew
one man band
one
on-call tour guide
ojt tariner
oil distributor
officer
office worker
office manager
odds compiler
nyc process server
nutritional therapist
nutrition consultant
nursing student
nurses aide
nurses
nursery teacher
nurse-i need
nurse ‘ s aid
nurse shift worker
nurse part time
nurse manager
nurse educator
nurse anesthetist
nurse advisor
nurse acro
nuclear medicine technologist/ct tech
nuclear medicine technologist
nuclear engineer
nt administrator
novel editor
northbrook park wedding photographer
normal or plus size model
nonprofit fundraiser
nonlife actuary
nonformal educator
non-functional test contractor
noc systems administrator right
noc engg i.
no dig gardener
nite supervisor/case manager
nissan tech
night security officer
night security
night porter
night custodian/maintenance worker
night clerk
night
newspaper editor
news repporter
news photographer
news cameraman
news assistant
newborn baby photographer
new scotland yard intern
new real beast
new nurse
new media communications assistant
new hire mentor
neutral channel i
neurology nurse
neurologist
neuro surgeon
networking /electronics tech
network/systems
network specialist
network operations center technician
network manager
network geek
network engineer/system administrator
network engineer/administrator
network engineer/"your company
network engineer contractor
network assistant
network architect
network administator
net admin
nerdy scientist
neonatologist
neonatal nurse practitioner
negotiator
navigator
naturopathic doctor
naturopath
natural rhythms creation coach
natural resources planner
natural resource biologist
natural health care practitioner
national security researcher
national health service nurse
nannybabysitter
nanny/domestic helper
nanny/ sitter
mystic detective
musician/composer
musical instrument repair technician
music therapist
music librarian
music journalist
museum docent
museum conservator
munitions officer
municipal link officer
multimedia teacher
multimedia producer
multimedia artist
multimedia
multilingual intern
multi-disciplinary designer
mri researcher
movie editor
movement consultant
mountain rescuer
mountain rescue volunteer
mountain guide
motorcycle police officer
motorbike flight messenger
motor mechanic
mother i
mortgage underwriter
mortgage originator
mortgage lender
mortgage banker
montessori tutor
montessori teacher
montessori primary teacher
monorail guide
monkey
money coach
money adviser
model fulltime
mod
mobile reflexologist
mobile practitioner
mobile pet groomer
mobile massage
mobile hairdresser
mobile front end developer
mobile beautician
mixed-media
mixed martial artist reporter
ministers
mining engineer
miner
milling sharpener
milk recorder
military doctor
midwife/nurse
midweek treat
middle school math teaching associate
middle school math
middle school counselor
middle manager
mid-level provider
mid-level manager
microsoft systems
microsoft infrastructure consultant
meteorologist/computer programmer
metallurgist
metal worker
metal fabricator
messenger driver
mermaid
merchant mariner
merchant marine
merchant application underwriter
merchandising intern
mentors
mentor/coach/counselor
mental medium
mental health worker
mental health support worker
mental health practitioner
membership advisor
mekanik
meeting designer
meeting coordinator
meditation teacher
medicinal chemist
medical vri interpreter
medical translator
medical transcriptionist home base
medical technologist
medical student
medical sales rep
medical review officer
medical physicist
medical person
medical officer
medical laboratory tech
medical lab tech
medical electrophysiology technologist
medical courier
medical content editor full-time
medical consultant
medical coding associate
medical anaesthetist
medical admin
media relations consultant
media consultant
media buyer
media assistant
media archivist
media architect
media analyst
med/surg nurse
med surge nurse
mechanical/software engineer
mechanical q.
mechanical drafter
mechanic/lube tech
mechanic problem
mech/electrical engineer
mech
meat-cutter
me
mathematics language teacher
mathematics coach
mathematic tutor
math tutor part time
math teaching assistant
math specialist
math intervention teacher
math instructor
math consultant
math coach
math
materials inspector
material control officer a.
mate
master engineer
master creativity coach
master bear builder
massage/physical therapist
massage therapist trader joe
mason
marketingassistent
marketing strategist
marketing queen
marketing consultant i
marketing communications specialist
marketing analytics specialist
market research manager
market analyst
maritime archaeologist
marine service engineer
marine photographer
marine mechanic
marble merchant
marble
manufacturer
manual orthopedic physical therapist
manicurist
mandarin interpreter
manaɡer
managing engineer
manager-hostess
management consultant specia
management
man
mammography technologist
male stripper
male
makeup/fx artist
makeup effects artist
makeup artist they
majority
major gifts officer
maintenance technician
maintenance person
maintenance landscaper
mail-man/postman
magazine art director
madison
machinest
machinecal draftsman
mac specialist
lyricist
lync trainer
lvn
lunchtime supervisor
lunchroom supervisor
lunch time assistant
lumber secretary
lube technician
lpn
lowly tech
lowly student assistant
low-level college administrator
loss prevention officer
loss adjuster
longshoreman
long term translator
long term substitute school guidance counselor
long shoreman
lone writer
london artist
logistics supervisor
logistics specialist
logistics engineer specialist
logistics coordinator
logistic officer
lodging managers
locomotive engineer
locations coordinator
local radio dj
local pastor
local news columnist
local lic
local government manager
lobbyist
loan
loader
lna
lived experience development worker
live-in-carer
live-in nanny
live nursery sales specialist
litigation consultant
literature tutor
literary consultant
literacy tutor
literacy teacher
linux systems
linux servers administrator
linguist
lingerie model
line therapist
limousine driver
limodriver
limo driver
lighting technican
lighting artist
lighting
lifestyle reporter
lifegaurd
life enrichment coordinator
life cycles educator
life coach —
licensed vocational nurse
licensed substances abuse counselor
licensed special education teacher
licensed sales producer
licensed psychotherapist
licensed professional counselor intern
licensed professional counselor
licensed practical nurse
licensed nursing assistant
licensed mental health counselor
licensed marriage family therapist
licensed marriage
licensed counselor
licensed consulting
licensed clinical laboratory scientist
licensed assistant
library technology assistant
library officer
library media tech
librarian…don
librarian ɑnd i
librarian technician
librarian clerk
liaison person
level iii network technician
level designer
level
legislative assistant
legal secretary/paralegal
legal researcher
legal nurse consultant
legal consultant
legal clerk
legal assistant downtown
legal advocate
legal adviser
lecturer i
learning technologist
learning services officer
learning advisor
lean expert/continuous improvement consultant
lead user researcher
lead artist
lead advisor
layout
law enformance officer
law enforcement ranger
law enforcement officer
law clerk
laundry attendant
launchsource employee
laser therapist
large format printer
large equipment fueler
laptop technician
language tutor
language services provider
language arts consultant
landscape photographer
landscape gardener
landscape architecture
lamaze
lactation counselor
lactation consultant
labtech
labourer
laborer
laboratory worker
laboratory monitor
laboratory
laboratorie technisian
labor/delivery nurse
labor organizer
labor doula
lab technologist
lab tech myself
lab tech
lab ta
lab scientist
lab research assistant
lab coordinator
l&d rn
knowledge-base
knowledge
knowldge management
knight
kitchen utility
kitchen designer
kinesiologist
kindergartner
kindergarten/second-grade paraprofessional
kindergarten aide
kindergarten
kids illustrator
kfc
key-worker specialising
key holder
kennel technician
karaoke dj
jv manager
jury consultant
juniorprofessor
junior web developer
junior web application developer
junior ux designer
junior sql developer
junior software engineer
junior researcher
junior physician
junior marine educator
junior lawyer
junior graphic designer
junior doctor
junior director
junior consultant
junior associate
junior architect
junior administrator
judicial law clerk
judgmental one
journalist writing
job title
job coach
jewelry photographer
jewelry d.
jeweler
jbpm quality engineer
jazz musician
javascript
java
it security consultant
it person
it network administrator
it guy
it business systems analyst
it
interpreter/translator
internet/intranet specialist
international tax
interior decorator
insurer
instructor
instructional assistant
infrastructure administrator
information consultant
infant teacher
industrial firefighter
india
independent professional consultant
independent media artist
independent escort
ict sector manager
i.
i
hypno-domina
hygienist
hybrid it-guy/developer
hvac engineer
husband
hunter
humanist celebrant
humaniatrian aid worker
human-wildlife conflict officer
human rights representative
human resources specialist
human resources
human resource manager
human resource assistant
hs language teacher
hr support assistant
hr manager
hr generalist
hr executive
hr director
housing counselor
housepainter
household maid
house parent
house painter
house manager
house keeper
house director
hotel night auditor
hotel manager myself
hotel maid
hotel housekeeper
hotel clerk
hostess/model
hostess/bartender
hospitalist np
hospital-based social worker
hospital nurse
hospice cna
horseshoer
horse trainer
honda salesman
homeopathic doctor
homehealth
home remodeler
home insurance agent
home instructor
home inspector
home health companion
home health attendant
home fashion consultant
home economist
home attendant
holistic wellbeing
holistic nutritionist
holistic medicine consultant/coach
holistic health consultant/coach
holistic health coach
holidays manager
hod carrier
hobby
history professor
historical research assistant
historical consultant
historian
histopathology technician
hinges
higher education administrator
high-school teacher
high school music teacher
high school maths teacher
high school library media specialist
high school esl teacher
high school english teacher
high school drama teacher
high school counselor
high school computer teacher
high school art teacher
hench man
helpdesk/support technician
helpdesk
help desk analyst
helicopter maintenance supervisor
heavy engineer
heavy duty diesel mechanic
heath tech
healthcare worker
healthcare it
healthcare chaplain
healthcare
health visitor
health specialist
health promotion officer
health practitioner
health knowledge information scientist
health improvement lead
health educationist
health coordinator
health consumer
health club manager
health care worker
health care physician
health blogger
head chef
head \blanka{nurse
harpsichordist
harpist
hardware designer
handler
handicrafts teacher
hallmark retail merchandiser
half-time
hair-dresser
hair stylist part time
hair salon manager
h.
gynaecological cytologist
guy
guitarteacher
guitarist
guide-interprete
guide full time
guest relations manager
guest lecturer
guest host
gsi/gsr my
gs-9
growth hacker
group product manager
group home superviso
group fitness instructor
group facilitator
groundskeeper/jack
grounds manager
ground engineer
groom
grocery store
grocery stocker
grocery assistant
grief counsellor
grey patch
great team
grease monkey
graveyard cashier
grapic designer
graphics manager
graphics
graphic illustrator
graphic designer/product photographer/it support tech
graphic designer/interior decorator
graphic designer,animator
graphic designer entrepreneur
graphic design associate
graphic desi
graphi designer/art director
graduate-school professor
graduate trainee
graduate teaching fellow
graduate student instructor
graduate student adviser
graduate research
graduate nurse
graduate intern
graduate analyst
gradual assistant
grader
gpsi
gp registrar
govt
government performance auditor
government electronics contractor onboard u.
government documents
government
governess
gov
gopher
google app developer
goods manager
good team
golf pro
golf course superintent
golf course architect
gn
gm
gluten
global ambassador
global advocate
global accounts
glamour model
gis/remote
gis coordinator
ghost writer
ghost tour guide
german attorney
geophysicist
geographer
genetic counsellor
generalist
general/ family practitioner
general worker
general practioner
general pediatrician
general clerk
general adviser
general adult
geek
ged teacher
ged instructor
gay-affirmative therapist
gass station
gas station clerk
gardener tomorrow
garden designer
garden coordinator
gaming attendant
g.
fіnancial officer
futures consultant
furniture specialist
furniture design/ consultant…
funeral director
fund raiser
fulltime specialty pharmacy technician
fulltime freelancer
fulltime freelance illustrator
fulltime fire fighter paramedic
fullstack developer
full-time web developer/programmer
full-time web developer
full-time va
full-time tutor
full-time travel blogger
full-time translator
full-time support worker
full-time supervisor
full-time self-employed therapist
full-time rn
full-time proofreader
full-time programmer
full-time professional tutor
full-time professional model
full-time personal trainer
full-time personal support worker
full-time officer
full-time night shift nurse
full-time mountain employee
full-time marketer
full-time lecturer
full-time kindergarten teacher
full-time karaoke host/ events coordinator
full-time janitor
full-time hebrew
full-time freelancer translator
full-time freelance writer
full-time freelance translator
full-time entrepreneur
full-time employee
full-time editor
full-time developer
full-time content writer
full-time client representative
full-time cardiac nurse
full-time army contractor
full-time alderman
full-time academician
full-stack
full time studio artist
full time sr
full time sculptor
full time professor
full time pharmacist
full time musician
full time mommy
full time metal sculptor
full time manager
full time java developer
full time hairdresser
full time hair stylist
full time genealogist
full time fashion designer/stylist
full time designer
full time contractor
full time composer
full time chaplain
full time call center agent
full time bookkeeper
full time blogger
full time artist/illustrator
full stack web developer
full figured/plus size
fu
front office assistant
front end manager
french assistant
freelancer/independent contractor
freelancer translator
freelancer tour guide
freelancer programmer
freelancer myself
freelancer developer
freelancer business consultant
freelancer artist
freelancer article writer
freelancer a.
freelanced screen-designer
freelance/hobbyist developer
freelance writer/editor
freelance whiteboard animator
freelance website designer
freelance video
freelance ux concept creator
freelance tv sound recorsist
freelance travel photographer
freelance tourist guide
freelance television production manager
freelance television cameraman
freelance technical writer
freelance technical editor
freelance technical diving instructor trainer
freelance teacher
freelance stylist
freelance style author
freelance storyteller
freelance stage manager
freelance spanish translator
freelance songwriter
freelance software engineer
freelance software designer
freelance software
freelance shooting director
freelance set
freelance seo consultant
freelance security consultant
freelance sales specialist
freelance researcher
freelance record producer
freelance public relations writer
freelance production assistant
freelance producer
freelance pr consultant
freelance photojournalist
freelance photographer specialising
freelance organisational consultant
freelance network/computer consultant
freelance net designer
freelance motion picture projectionist
freelance motion
freelance media producer
freelance master
freelance marketing consultant
freelance marine biologist
freelance manga editor
freelance makeup artist part time
freelance location sound mixer
freelance lifestyle
freelance layout artist
freelance landscape designer
freelance instructional designer
freelance illustrator/animator
freelance guitarist
freelance graphic-artist
freelance graphic designer/art director
freelance graphic artist/painter
freelance ghostwriter
freelance french translator
freelance food writer
freelance financial consultant
freelance filmmaker
freelance film projectionist
freelance entertainment journalist
freelance english
freelance educator
freelance educational counselor
freelance editor/writer
freelance editor/proofreader
freelance dj
freelance digital strategy manager
freelance digital filmmaker
freelance digital designer
freelance designe
freelance deckhand/engineer
freelance database programmer
freelance dancer
freelance dance artist
freelance cycling journalist
freelance curator
freelance cross media designer
freelance creative writer
freelance cook
freelance content developer
freelance consultant engineer
freelance conference interpreter
freelance commercial
freelance choreographer
freelance ceramic designer
freelance cartoonist
freelance carpenter
freelance business consultant
freelance book designer
freelance artist working
freelance article writer
freelance art director
freelance application platform consultant
freelance and i study culture management
freelance advertising copywriter
freelance administrative assistant makeup
freelance academic editor
freelance 3d artist
free-lancer translator
free-lancer i aim
free-lancer
free-lance trainer
free-lance science writer
free-lance journalist
free-lance designer
free-lance consultant
free lancer i
free lance web
free lance translator
free lance photographer
free economist
free artist
franchise consultant
framework developer
fox news contributor
fourth grade teacher
foster carer
foster care case worker
foster care
fossil preparator
formulations chemist
formulation scientist
fork-lift driver
forest ranger
forest firefighter
forest fire ranger
forensic mental health support worker
foreign student
forecasting analyst
forced labor
footwear technologist
footman
football coach
food stylist
food service manger
food service managers
food seller
food safety/quality assurance specialist
food reviewer
folklorist
fne
flower-decorator
flooring specialist
flight nurse
fittings model
fitting model
fitter welder
fitness trainer n nutritionist
fitness coach
fitness
fit model
fisheries biologist
fish packer
first-grade chinese teacher
first-aider
first year analyst
first nations support worker
first grade teacher
first assistant director
firmware engineer
firefighter/emt
firefighter paramedic
fire sprinkler pipe fitter
fire protection project manager
fire fighter/emt
fire engineer
fire captain
fine art portrait
fine art photographer
fine
financial/loss adjuster
financial systems developer
financial specialist
financial rep
financial modeller
financial journalist
financial executive
financial controller
financial content writer
finance consultant
finance associate
finance assistant
filmmaker/art director/production designer/editor
film production manager
film critic
fill
file clerk
field tech
field supervisor
field operation assessor
field manager
field executive
field contract administrator
field archaeologist
field agent
fiddle player
fiction writer
festival photographer
fencing referee
fencing contract
felony prosecutor
fee
federal contract
features reporter
feature film editor
fax operator
fat acceptance activist
fast food manager
fashion-photographer
fashion photographer
fashion liaison
farrier
family physician
family nurse practitioner
family medicine physician
family counsellor
fair hostess
factory storeman
factor
facility consultant
facilities project manager
fabric desiger
fabric artist
fabracator
fa
events photographer
european tour guide
ese teacher
escort
equestrian course designer
environmental scientist
english teacher
engineer/researcher
engineer-technologist
emt
employee
electronics tech
electronic salesmen
electronic designer/programmer
electrician,my own place
educational researcher
editor
duty manager
duo
dubstep dj
dsp
dsa practitioner
dry wall contractor
drupal developer
drug rep
drug investigator
drug counselor
drug counsellor,which
driving instructor
driver/guide
driver education instructor part time
dressmaker
dressing room attendant
dressing chef
dramaturg
dramatist
dramatherapist
drama trainer
dpe
dp ’
dotor
doormat
door
donor relations officer
domestic violence prevention worker
domestic violence advocate
domestic maid
domestic care nurse
domain software tester
domain admin
dog handler
dog
doer
dod contractor
docutech
documentation manager
documentary photographer
documentary cameraman
documentalist
document translator
doctor physician
doctor it
dock manager
docent-tour guide
dj host
division manager
diving instructor
diversity educator
diversity consultant
diversional therapist
divemaster
dive guide
ditch digger/factory worker
district manager
distric contractor/architect
disability rights
disability
director hr
directional driller
direct support professionals
direct support
direct service provider
direct sales rep fpr comcast/xfinity
direct care staff
digital trainee
digital tech
digital strategist
digital signal processing
digital retoucher
digital press operator
digital portfolio manager
digital photographer
digital media specialist
digital media educator
digital marketing apprentice
digital literacy coach
digital guy
digital design
digital creative director
digital communications specialist
digital communication consultant
digital arts teacher
digital artist
digital analyst
dietitian full-time
dietitian
dietary supervisor
dietary aid
diesel instructor
dictation typist
dialysis technician
dialysis tech
diabetic specialist nurse
devil summoner
developmental specialist
development producer
development director
development coordinator
development
developer/architect
developer/analyst
developer researcher
developer programs engineer
developer evangelist
develoment finance manager
dev
detail cleaner
destination photographer
desktop soe guy
desktop engineer
desk attendant
desk assistant
designer/printer
designer/illustrator
designer/fe developer
designer sr
designer marketing exec
designer manager
design-engineer/designer
design specialist
design eng
design educator
desiger
dermatology nurse practitioner
deputy sales manager
deputy manger
deputy district attorney
deputy corrections officer
dept
departmental manager
department lead
dental nurse it
dental hygienst
dental hygienist(i
dental hygienist full time
dental consultant
dental clinician
dental assistant/receptionist
demonstrator
dementia champion
delivery woman
delivery postman
delivery partner
delivery man
deli clerk
delhi
delegate
defense attorney
deer biologist
deep sea
deep desktop support expert
deburr tech
death surrogate
dealership technician
dce
daycare manager
daycare assistant
day trader
day counselor
day
database/web developer
database/web administrator
database programming
database developer
database analyst
data typish
data science programmer
data retrieval specialist
data journalist
data engineer/scientist
data conversion analyst
data artist
data analytics consultant
data analyst writing code
dance instructor remember
dallas county master gar
daka
cytologist
cyclo driver
cycle courier
cybersecurity
cyber security analyst
cutter
cusual labourer
customs inspector
customs clearance agent
customs broker
customer support executive
customer service operator
customer service officer
customer care representative
custom car designer
custom cabinet designer
custodian/bus driver archdale trinity
cust
curriculum writer
curriculum reviewer
curriculum assistant
current affairs researcher reporter
currency volatility trader
culture/feature journalist
culinary producer
ctrs my mother
ctr
cti/telephony specialist
cs(canine supervisor
cs professor
cs
croupier part time
cross-disciplinary artist
cross platform developer/engineer
crma
crisis therapist
crisis manager
crisis counselor
criminal defense lawyer
criminal defense attorney
crime scene investigator
crime investigator
crime analyst
credit counsellor
creativity performance coach
creative technologist
creative strategy director
creative solutions consultant
creative lead
creative agent
crane operator
craftsperson
craft designer
cpp programmer
cpe supervisor
cpa auditor
cp
cow-cockey
courtesy clerk
court reporter
course manager
couples counsellors
couple therapist
couple counselor
counselor/teacher
counselor part-time
counselling psychologist
councillor
council officer
cota
costume-m
costume actor
cosplay photographer
cosmetic merchandiser
corrections deputy
correctional officer/ dispatcher
corporate video producer
corporate secretary
corporate sales rep
corporate sales executive
corporate paralegal
corporate level microbiologist
corporate flight attendant
corporate finance
corporate educator
corporate chaplain
corporate attorney
corp
core team
core process psychotherapist
copywriter/proofreader
copyright agent
copyist
copyeditor
copier technician
coop
cooker
cook supervisor
controls system programmer
control systems engineer
control room
control engineer
contributor fox
contractual freelancer
contractor/llr
contracting carpenter
contracted grant writer
contract surveyor
contract specialist
contract researcher
contract nursing
contract lawyer
contract individual
contract engineer(sw/hw
contract database administrator
contract case writer
contract bike
continuous improvement consultant
content/socialmedia manager
content producer(www
content producer
content marketing intern
content head
content director
content designer
content creator
contemporary mixed media artist
contact centre customer service advisor
consumer affairs specialist
consulting software tester
consultant/contract electrical engineer
consultant travel planner
consultant software
consultant psychiatrist
consultant programmer
consultant pharmacist
consultant i
consultant historian
consultant archaeologist/heritage consultant
consultant anesthesiologist
consultant @
constructor
construction site inspector
construction management engineering
construction labour
construction estimator
conservation
confidential informant
conference interpreter
conference coordinator
conduit assembler
concert master
conceptual portrait
concept manager
concept design
concept
computerized accounting
computer teacher
computer systems engineer
computer systems department manager
computer system administrator
computer shop-assistant
computer science researcher
computer repair technician
computer programmer half
computer operations mgr
computer network administrator
computer lab attendant
computer games artists
computer engineer
computer assistant
computational scientist
compulsory freelance social worker
comptuer network software technician
compliance coordinator
completely freelance painter
complementary team
compassionate , transformative guide
company secretary reporting
companion
community support individual
community rail development officer
community police officer
community pharmacist
community organizer
community officer
community minister
community liaison officer
community health worker
community health volunteer
community facilitator
community educator
community drug educator
community developer
community arts project coordinator
communications secretary
communications officer
communications manager
communications director
communications consultant
communications advisor
communication trainer
communication technologist
communication designer
communication coordinator
communication
commodoties analyst
commodity lumber broker
commissioned salesman
commissioned portrait artist
commission
commercial stingless beekeeper
commercial security officer
commercial realtor
commercial real estate lease administrator
commercial real estate attorney
commercial radio installer
commercial model
commercial marketing student writer
commercial litigation attorney
commercial lender
commercial landscaper
commercial animator
comics illustrator
comic book artist
comfort keeper
comercial
comedian
combat medic
combat engineer
colorist
color kitchen lead
color advisor
collision tech bodyman
colliery viewer
college student
college program advisor
college library assistant
college lecturer
college instructor
college english professor
college administrator
college adjunct professor
collector
collective worship councillor
colleague
collateral loan broker
collaborator
collaborative pianist
cognitive behavioral therapist
coffee distributor
code monkey
cobbler
coach/counsellor/guide
co-owner
co-ordinator
co-op student
co-author
co
cnc programmer
cnc machine programming engineer
cna full time
cma
club promoter
clown-dance character
clown doctor
cloud evangelist
clothing designer
clothes-maker
closing coordinator
close team
clinical trials program manager
clinical technician
clinical research coordinator
clinical research assistant
clinical pediatric dietitian
clinical office assistant
clinical nutritionist
clinical nurse specialist
clinical nurse
clinical laboratory technician
clinical informaticist
clinical hypnotist
clinical educator
clinical chemist
client executive
client delivery manager
client coordinator
client advisor
client
clerical worker
clerical staff
clerical assistant
clerck
cleaning team
cleaner i
classical homeopath
classic bike mechanic
class assistant
civilian love it
civilian human resources specialist
civilian contractor
civil/environmental engineer
civil litigator
civil engineer tech
civil enforcement officer
city worker
city planner
city guide
circus coach
circulation supervisor
circulation assistant
cio
cinema projectionist
church secretary
church planter
church minister
church administrator
choral director
chiropractic physician
chip engineer
chinese language tutor
chimney sweeper
children photographer
children event planner
childminder i
childcare teacher
child psychologist
child practitioner
child health nurse
child care teacher i
child abuse investigator
chief technical officer
chief officer
chief information security officer
chief curator
chicken farmer
chemistry lecturer
chemistry laboratory technician
chemistry
chef/food service director
cheer coach
check-in agent
chauffeur
chartered psychologist
charity lawyer
character art supervisor
change agent
chalkboard artist
cg operator
cg artist
cfe
certified yoganurse
certified veterinary technician
certified toefl instructor
certified substance abuse counselor
certified public accountant
certified professional coder
certified occupational therapy asst
certified nursing
certified nurse midwife
certified nurse assistant
certified nurse aide
certified microbiologist
certified medical interpreter
certified medical asst
certified master mechanic
certified health coach
certified flavor chemist
certified esl teacher
certified educator
certified dog trainer
certified clinical research coordinator
certified beauty advisor
cert iv
ceritifed nurses
ceo inn
ceo
centreless
celebrity manicurist
cd
cca
cave guide
catty receptionist
catholic church musician--i
catering manager
cater-waiter
catechist
catastrophe insurance adjuster
catalyst
catalog assistant
cat sitter
cat hunter
cat
casual employee
casual community nurse
casting producer
cashier/stocker
cashier/customer assistance person
cashier/clerk
cashier/bagger
cashier part time
case worker/teacher
case worker
cart puller
cart girl
carrier
carpet cleaner
carpenter my hobbies
carman
careworker
caregiver/cna
careers adviser
career coach
care team leader
care partner(which
care manager
care
cardinals writer/columnist
caravan technitian
car-salesman
car mechanic
car detailer
car dealership co-owner
car
cantor
canoe guide
canine massage therapist
canine behavioral consultant
cancer surgeon
cancer registrar
campus supervisor
campus nurse
campus minister
campaigns manager
camp nurse
camp counsellor
camera woman
cam model
café bar team member
cadet
cad/cam technician
cad manager
cable installer
cable
cabinet-maker
cabin crew
cab driver
buying
butler
buteyko breathing educator
bussiness development executive
busser
businessman
business/sales analyst
business technology analyst
business system analyst
business software developer
business psychologist
business process
business man
business growth coach
business development
business communication skills trainer
business analysts
business administrator
bus schedules compiler
burrito roller
burger
bunny girl waitress
building renovation worker
building performance engineer
building manager
build
buckner children
bridge
brazer
branding specialist
brand protection analyst
brand manager
brand ambassador
braille translation editor
bpo quality training
boxer
bow technician
bouncer/ doorman
botanist
botanic apothecary
boost
boom-operator
booking agent
book translator
book shepherd
book seller
book scout
book scanner
book publicist
book
bond enforcement officer
boiler operator
boiler engineer
bodywork therapist
bodyguard
body shop manager
body shop estimator
body guard
boat carpenter
board
bloody analyst
blacksmith
black topper
bisexual women
birth parent counselor
biotechnologist
biostatistician
biomedical scientist/cytotechnologist
biomedical scientist
biomechanical engineer
biological statistician
bioethicist
billing specialist
billing clerk
bilingual/esl teacher
bilingual sales representative
bilingual kindergarten teacher
bilingual chief poll worker
bikini barista
bigdata engineer
bicycle
bfing peer couselor
bespoke
bereavement counsellor
belly dancer
bellman
behavioural support worker
behaviorist
behavioral specialist
behavioral medicine specialist
behavioral health tech
behavioral health
behavior specialist
beauty-consultant
beautician i
bear guide
bass teacher
basketmaker
basis consultant
bartender/stripper
bartender,sounds
barn assistant/trainer
barista part time
bariatric educator/clinical nutritionist
bargeman
barber
bar supervisor
bar manager
bar man
bar maid
bar
banking it
banking analyst
bank courier
band teacher
baltimore city
ballroom dance teacher
ballet instructor
bail bondsman
bail bonds enforcer
baggage service agent
baggage handler
bag boy
background
backend java developer
backend engineer
backcountry
baby-stylist
baby photographer
auditing officer
audio-engineer
asst prof
associate professor
assitant teacher
assistant chef
asphalt technologist
artist instructor
art director
army guard soldier
armed security office
armed guard
archivist
architecture
arborist assistant
apprentice
applications interface designer
android os developer
analyst
an rn
alltime powerpoint designer
alarm operator
airline
air conditioning tech
aerospace engineer
acupuncturist
a pharmacy dispenser
a goat
a cowboy
911 dispatcher
911 call receiver
8th grade teacher
411 operator
3rd party retailer
3d modeler
3d artvisualiser
3d artist/animator
3d artist myself
2nd grade
2nd assoc
2d artist
2d animator
1st ad i
1:1 tutor
1:1 aide
</textarea>

This is not perfect but this pretty good value considering how little was required.

## National stereotypes

Here are the results for different nationalities.
*Hopefully useless disclaimer: This is measuring stereotypes, not actual fact.* 

![French people]({{ "/images/commoncrawl/french.jpg" }})
<center><b>french people are...</b></center><br/>

![Japanese people]({{ "/images/commoncrawl/japanese_people_are_jj.png" }})
<center><b>Japanese people are...</b></center><br/>

![Russian people]({{ "/images/commoncrawl/russians_are_jj.png" }})
<center><b>Russian people are...</b></center><br/>

![American people]({{ "/images/commoncrawl/americans_are_jj.png" }})
<center><b>Americans are...</b></center><br/>

![Italian people]({{ "/images/commoncrawl/italians_are_jj.png" }})
<center><b>Italians are...</b></center><br/>

## People's favorite?

One can also try to extract noun phrases instead of a single word. For instance,
here is a list of people's favorite thing. For instance, the first tag cloud was generated using the pattern: `my favorite city is <noun phrase>`.

![Favorite city]({{ "/images/commoncrawl/my_favorite_city_is_np.png" }})
<center><b>Favorite city</b></center><br/>

![Favorite band]({{ "/images/commoncrawl/my_favorite_band_is_np.png" }})
<center><b>Favorite band</b></center><br/>

## What's Google? What's Trump?

It's also fun to search for the noun phrases associated
to something.

For instance, here is what is said about Google.

![Google is ...]({{ "/images/commoncrawl/google_is_np.png" }})
<center><b>Google is ...</b></center><br/>

... or what is said about Donald Trump


![Donald Trump is ...]({{ "/images/commoncrawl/trump_is_np.png" }})
<center><b>Trump is...</b></center><br/>



# A couple of personal news.

You may have noticed I haven't blogged for a while. In the last few months, I
crossed a lot of very interesting things I wanted to blog about but I preferred
to allocate my spare time on the development [tantivy](https://github.com/tantivy-search/tantivy).
0.5.0 was a pretty big milestone. It includes a lot of query-time performance
improvement, faceting, range queries, and more...  Development has been going
full steam recently and tantivy is getting rapidly close to becoming a decent
alternative to Lucene. 

I am unfortunately pretty sure I won't be able to keep
up the nice pace.  

![First daughter]({{ "/images/commoncrawl/baby.jpg" }})

First, my daughter just got born! I don't expect to have 
much time to work on tantivy or blog for quite a while.

Second, I will join Google Tokyo in April. I expect it will this new position
to nurture my imposter syndrome. Besides, starting a new job usually bring 
its bit of overhead to get used to the new position / development
environment. The next year will be very busy for me !

By the way, I will travel to Mountain View in May, for Google Orientation. 
If you know about some interesting events in San Francisco or Mountain View 
during that period, please let me know!

