#%%
from eventregistry import *
import time
import json
import operator

class ERReader:
    """EventRegistry operations."""
    def __init__(self, perpage, days):
        self.perpage = perpage
        self.days = days
        self.ereg = EventRegistry()
        self.results = []
        self.pages = -1

        # read login settings
        self.file_name = open('settings.json', 'r')
        settings_json = self.file_name.read()
        self.settings = json.loads(settings_json)
        self.ereg.login(self.settings["username"], self.settings["password"], False)

    def get_articles(self, concept, startdate, enddate):
        """Returns a list of articles."""
        query = QueryArticles(lang=["eng"])
        query.setDateLimit(startdate, enddate)
        query.addConcept(self.ereg.getConceptUri(concept))
        query.addRequestedResult(RequestArticlesInfo(
            count=self.perpage,page=1,
            returnInfo=ReturnInfo(
                articleInfo=ArticleInfoFlags(
                    bodyLen=10, duplicateList=True, concepts=True,
                    categories=True, location=True, image=True
                ))))
        res = self.ereg.execQuery(query)
        self.pages = res["articles"]["pages"]
        print(self.pages, " pages")
        
        for i in range(self.pages, 0, -1):
            print(i)
            new = self.get_articles_page(concept, startdate, enddate, i)
            self.results.extend(new)
            self.print_articles(new)
        
        return self.results

    def print_articles(self, new):
        for article in new:
            print(article["date"], article["time"])

    def get_articles_page(self, concept, startdate, enddate, pagenum):
        """Returns a list of articles per page."""
        query = QueryArticles(lang=["eng"])
        query.setDateLimit(startdate, enddate)
        query.addConcept(self.ereg.getConceptUri(concept))
        query.addRequestedResult(RequestArticlesInfo(
            count=self.perpage, page=pagenum, 
            returnInfo=ReturnInfo(
                articleInfo=ArticleInfoFlags(
                    bodyLen=300000, duplicateList=True, concepts=True,
                    categories=True, location=True, image=True
                ))))
        res = self.ereg.execQuery(query)
        sorted_articles = sorted(res["articles"]["results"], key=lambda d: (d["date"], d["time"]))
        return sorted_articles

    def get_articles_period(self, concept, startdate, enddate):
        """Returns list for articles for the whole (long) period"""
        sdate = startdate
        edate = enddate

        while edate > sdate:
            if (edate - sdate).days > self.days:
                eudate = sdate + datetime.timedelta(days=self.days)
            else:
                eudate = edate

            print("GET:", sdate, eudate)
            self.get_articles(concept, sdate, eudate)

            sdate = eudate + datetime.timedelta(days=1)


    def save_articles(self, concept):
        with open(concept + ".json", 'w') as outfile:
            json.dump(self.results, outfile)


ereader = ERReader(5, 2)
results = ereader.get_articles_period("Borut Pahor", datetime.date(2016, 12, 1), datetime.date(2017, 1, 1))
ereader.save_articles("BorutPahor")

