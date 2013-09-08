$ ->
    model = null
    $.get "/js/infatuate/baskerville.txt", {}, (data)->
        $('#sample').val data
    $("#run").click ->
        text = $('#sample').val()
        $('#sample').change ->
            model = null
        if not model?
            model = infatuate.learn text
        $('#result').html model.generate_text 1000
