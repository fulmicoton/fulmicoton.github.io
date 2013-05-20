$ ->
    model = null
    $("#run").click ->
        text = $('#sample').val()
        $('#sample').change ->
            model = null
        if not model?
            model = infatuate.learn text
        $('#result').html model.generate_text 1000
