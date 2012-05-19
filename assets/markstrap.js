(function() {
  var addMenus;

  addMenus = function($h1) {
    var $navbar, major, minor;
    major = 0;
    minor = 0;
    $navbar = $("#sectionList ul.nav-list");
    $("h1, h2").each(function() {
      var $headEl, $navElement, sectionId, title;
      $headEl = $(this);
      title = $headEl.html();
      $navElement = $("<li>");
      if (this.tagName === "H1") {
        major += 1;
        minor = 0;
        sectionId = "section_" + major;
        $navElement.addClass("nav-header");
        $navElement.html("" + title);
      } else {
        this.tagName === "H2";
        minor += 1;
        sectionId = "section_" + major + "_" + minor;
        $navElement.html("<a href='#" + sectionId + "'>" + title + "</a>");
      }
      $headEl.before($("<span id='" + sectionId + "' class='bookmark'></span>"));
      return $navbar.append($navElement);
    });
    return $('[data-spy="scroll"]').each(function() {
      return $(this).scrollspy('refresh');
    });
  };

  $(function() {
    addMenus($("body"));
    return $('#navbar').scrollspy({
      offset: 50
    });
  });

}).call(this);
