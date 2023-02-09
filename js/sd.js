
/*
 * click the query button to get the images
 */
const JOB_NOT_EXISTS_ERROR = "JOB_NOT_EXISTS_ERROR"
const INTERNAL_ERROR = "INTERNAL_ERROR"
const CODE_OK = "OK"

const PAGE_SIZE = 24
const SEARCH_PAGE_SIZE = PAGE_SIZE
const MAX_PROMPT_DISPLAY_LENGTH = 25
var page_num = 1

var query_interval_id
var query_times, queue_len, state, image_urls
var prompt_str = undefined
var negative_prompt = undefined
var steps = 50
var width = undefined
var height = undefined
var guidance_scale = 7.5
var random_seed = undefined
var sampler = "ddim"
var n_samples = undefined
var job_not_exists = false
var job_internal_error = false
var job_id
var image_details = []
var search_words = ""
var is_search = false
var host = window.location.host
protocol = "http"
if (host != "127.0.0.1") {
    protocol = "https"
}
$.ajaxSettings.async = false;

$("#search_btn").click(function () {
    Init()
    search_words = $("#search_words").val()
    EmptyDisplay()
    Search(search_words, page_num)
    page_num++
})
$("#my_search_btn").click(function () {
    Init()
    search_words = $("#search_words").val()
    EmptyDisplay()
    Search(search_words, page_num, true)
    page_num++
})

$("#query_btn").click(function () {
    job_id = $("#job_id").val()
    localStorage.setItem("job_id", job_id);
    var reg = /^[0-9]+$/gi
    if (job_id == 0 || !reg.test(job_id)) {
        $("#job_id").val("please input job id")
    } else {
        //初始化
        //ajax同步获取数据
        Init()
        async = false
        if (query_interval_id != undefined) {
            clearInterval(query_interval_id)
        }

        QueryOnce(job_id)
        //每隔x秒查一次
        var x = 1000
        query_interval_id = setInterval("QueryAndUpdate(" + job_id + ")", x);

    }
})

$("#generate_btn").click(function () {
    if (IsLogin()) {
        if ($("#prompt").val() == "") {
            console.warn("please input prompt")
            $("#prompt").focus()
        } else {
            GenerateInitilize()
            async = false
            job_id = Generate(async)
            if (job_id != undefined) {
                if (query_interval_id != undefined) {
                    clearInterval(query_interval_id)
                }

                QueryAndUpdate(job_id)
                var x = 1000
                query_interval_id = setInterval("QueryAndUpdate(" + job_id + ")", x);
            } else {
                DisplayError()
            }
        }
    } else {
        $("#loginModal").modal("show")
    }
})

function InitLoadPage() {
    ShowNav()
    image_details = []
    page_num = 1
    for (start_page_num = 1; page_num < start_page_num + 1; page_num++) {
        var continued = LoadGeneratedImages(page_num, is_my)
        if (continued == false) {
            break
        }
    }
}
function InitLoadMyPage() {
    ShowNav()
    if (!IsLogin()) {
        $("#loginModal").modal("show")
    } else {
        image_details = []
        page_num = 1
        for (start_page_num = 1; page_num < start_page_num + 1; page_num++) {
            var continued = LoadGeneratedImages(page_num, is_my)
            if (continued == false) {
                break
            }

        }
    }
}

function ScrollPage() {
    var scrollTop = $(this).scrollTop(); //scroll to top's height
    var scrollHeight = $(document).height(); //this pages's height
    var clientHeight = $(this).height(); //now height
    if (scrollTop + clientHeight >= scrollHeight - 30) {
        var continued = true
        if (is_search) {
            continued = Search(search_words, page_num, is_my)
        } else {
            continued = LoadGeneratedImages(page_num, is_my)
        }
        if (continued) {
            page_num++
        }
    }
}

function IsLogin() {
    $.ajaxSettings.async = false;
    var is_login = false
    $.get("/checkLogin", function (data) {
        try {
            if (data.hasOwnProperty("data")) {
                if (data["data"]["is_login"] == true) {
                    is_login = true
                }
            } else {
                is_login = false
            }
        } catch (error) {
            console.log(error)
            is_login = false
        }
    })
    return is_login
}

function Init() {
    query_times = 0
    queue_len = undefined
    image_urls = []
    prompt_str = undefined
    negative_prompt = undefined
    steps = 50
    width = undefined
    height = undefined
    guidance_scale = 7.5
    random_seed = undefined
    sampler = "ddim"
    n_samples = undefined
    job_not_exists = false
    job_internal_error = false
    page_num = 1
    image_details = []
    search_words = ""
    is_search = false

}

function GenerateInitilize() {
    Init()
    if ($("#width").val() == "" || $("#width").val() == 0) {
        width = 768
        $("#width").val(width)
    }
    if ($("#height").val() == "" || $("#height").val() == 0) {
        height = 768
        $("#height").val(height)
    }
    if ($("#steps").val() == "" || $("#steps").val() == 0) {
        steps = 50
        $("#steps").val(steps)
    }
    if ($("#n_samples").val() == "" || $("#n_samples").val() == 0) {
        n_samples = 8
        $("#n_samples").val(n_samples)
    }
    if ($("#guidance_scale").val() == "" || $("#guidance_scale").val() == 0) {
        guidance_scale = 7.5
        $("#guidance_scale").val(guidance_scale)
    }
    if ($("#random_seed").val() == "" || $("#random_seed").val() == 0) {
        random_seed = 42
        $("#random_seed").val(random_seed)
    }
    if ($("#sampler").val() == "") {
        $("#sampler").val("ddim")
    }
}

function EmptyDisplay() {
    $("#queue_div").empty()
    $("#row_div").empty()
}

function SetDivById(div_id, str) {
    $("#" + div_id).val(str)
}

function DisplayJobNotExists(job_id) {
    var queue_div = $("#queue_div")

    q_text = "<p>Job:<red>" + job_id + "</red> not exists</p>"
    queue_div.append($(q_text))
    $(".container").append(queue_div)
}
function DisplayError() {
    var queue_div = $("<div></div>")
    queue_div.attr("id", "queue_div")

    q_text = "<p>Internal Error</p>"
    queue_div.append($(q_text))
    $(".container").append(queue_div)
}

function DisplayInProgress(n) {
    var queue_div = $("#queue_div")
    queue_div.empty()
    var tmp = ""
    for (var i = 0; i < n; i++) {
        tmp += "."
    }
    queue_div.append($("<p>current request is processing" + tmp + "</p>"))
    $(".container").append(queue_div)
}

function DisplayQueue(n) {
    var queue_div = $("#queue_div")
    queue_div.empty()
    queue_div.append($("<p>current request is order <red>" + n + "</red></p>"))
    $(".container").append(queue_div)
}

function DisplayPrompt(p_str) {
    if (p_str != undefined) {
        $("#prompt").val(p_str)
    }
}

function DisplayJobid(j_id) {
    if (j_id != undefined) {
        $("#job_id").val(j_id)
    }
}
function DisplayQueryInfo() {
    // $("#job_id").val(job_id)
    UpdateElementValue("#job_id", job_id)
    // $("#prompt").val(prompt_str)
    UpdateElementValue("#prompt", prompt_str)
    // $("#width").val(width)
    UpdateElementValue("#width", width)
    // $("#height").val(height)
    UpdateElementValue("#height", height)
    // $("#steps").val(steps)
    UpdateElementValue("#steps", steps)
    if (typeof (steps) != "undefined") {
        document.getElementById('steps_show').innerHTML = steps;
    }
    if (typeof (guidance_scale) != "undefined") {
        document.getElementById('guidance_scale_show').innerHTML = guidance_scale;
        $("#guidance_scale").val(guidance_scale)
    }
    // $("#random_seed").val(random_seed)
    UpdateElementValue("#random_seed", random_seed)
    // $("#negative_prompt").val(negative_prompt)
    UpdateElementValue("#negative_prompt", negative_prompt)
    if (typeof (sampler) != "undefined") {

        document.getElementById('sampler').value = sampler;
    }
    // $("#n_samples").val(n_samples)
    UpdateElementValue("#n_samples", n_samples)
}

function UpdateElementValue(element, value) {
    console.log(element)
    console.log(value)
    if (typeof (value) != "undefined") {
        $(element).val(value)
    }

}

function UpdateEditorImages(image_urls, job_id) {
    var row_photos = $("#row_div")
    for (var i = 0; i < image_urls.length; i++) {
        var div_elem = $("<div></div>")
        div_elem.addClass("col-sm-3 col-md-2 col-lg-2 mb-1 item")
        div_elem.attr("align", "center")
        var image_url = image_urls[i]
        var a_elem = $("<a></a>")
        a_elem.attr("data-lightbox", "photos")
        image_elem = $("<img>")
        image_elem.addClass("img-fluid img-thumbnail")
        image_elem.attr("src", image_url)
        image_elem.attr("id", "list-img")
        a_elem.append(image_elem)
        div_elem.append(a_elem)

        var j_span_elem = $("<span>" + job_id + "</span>")
        j_span_elem.attr("id", "j_span")
        j_span_elem.hide()
        div_elem.append(j_span_elem)
        row_photos.append(div_elem)
    }
}
function UpdateImages(image_urls, prompts, job_ids, image_ids) {
    var row_photos = $("#row_div")
    for (var i = 0; i < image_urls.length; i++) {
        var div_elem = $("<div></div>")
        div_elem.addClass("col-sm-3 col-md-2 col-lg-2 mb-1 item")
        div_elem.attr("align", "center")
        var image_url = image_urls[i]
        var a_elem = $("<a></a>")
        a_elem.attr("data-lightbox", "photos")
        image_elem = $("<img>")
        image_elem.addClass("img-fluid img-thumbnail")
        image_elem.attr("src", image_url)
        image_elem.attr("id", "list-img")
        a_elem.append(image_elem)
        div_elem.append(a_elem)
        if (prompts != undefined) {
            if (Array.isArray(prompts)) {
                var s_span_elem = $("<span>" + ShortenString(prompts[i], MAX_PROMPT_DISPLAY_LENGTH) + "</span>")
                div_elem.append(s_span_elem)
                var l_span_elem = $("<span>" + prompts[i] + "</span>")
                l_span_elem.attr("id", "l_span")
                l_span_elem.hide()
                div_elem.append(l_span_elem)
            } else {
                var s_span_elem = $("<span>" + ShortenString(prompts, MAX_PROMPT_DISPLAY_LENGTH) + "</span>")
                div_elem.append(s_span_elem)
                var l_span_elem = $("<span>" + prompts + "</span>")
                l_span_elem.attr("id", "l_span")
                l_span_elem.hide()
                div_elem.append(l_span_elem)
            }
        }
        if (job_ids != undefined) {
            var j_span_elem = $("<span>" + job_ids[i] + "</span>")
            j_span_elem.attr("id", "j_span")
            j_span_elem.hide()
            div_elem.append(j_span_elem)
        }

        if (image_ids != undefined) {
            var i_span_elem = $("<span>" + image_ids[i] + "</span>")
            i_span_elem.attr("id", "i_span")
            i_span_elem.hide()
            div_elem.append(i_span_elem)
        }
        row_photos.append(div_elem)
    }
}

function Update() {
    EmptyDisplay()
    DisplayQueryInfo()
    if (job_internal_error) {
        console.log("job_internal_error")
        clearInterval(query_interval_id)
    } else if (job_not_exists == true) {
        console.log("job_not_exists")
        DisplayJobNotExists(job_id)
        clearInterval(query_interval_id)
    } else if (queue_len != undefined) {
        if (state == 2 || state == 3) {
            clearInterval(query_interval_id)
            UpdateEditorImages(image_urls, job_id)
        } else if (state == 1) {
            DisplayInProgress(query_times)
        } else {
            DisplayQueue(queue_len)
        }
    }
}

function QueryAndUpdate(job_id) {
    QueryOnce(job_id)
    query_times += 1
    Update()
}

function ParseResult(mydata) {
    try {
        var code = mydata["code"]
        if (code == CODE_OK) {
            queue_len = mydata["data"]["queue_len"]
            state = mydata["data"]["result"]["state"] != undefined ? mydata["data"]["result"]["state"] : 1
            prompt_str = mydata["data"]["result"]["prompt"]
            width = mydata["data"]["result"]["width"]
            height = mydata["data"]["result"]["height"]
            steps = mydata["data"]["result"]["steps"]
            guidance_scale = mydata["data"]["result"]["guidance_scale"]
            random_seed = mydata["data"]["result"]["random_seed"]
            negative_prompt = mydata["data"]["result"]["negative_prompt"]
            sampler = mydata["data"]["result"]["sampler"]
            n_samples = mydata["data"]["result"]["n_samples"]
            job_id = mydata["data"]["result"]['job_id']
            job_not_exists = false
            if (state == 2) {
                var images_str = mydata["data"]["result"]["result"]
                var obj
                obj = JSON.parse(images_str)
                image_urls = obj["image_urls"]
            }
        } else if (code == JOB_NOT_EXISTS_ERROR) {
            console.log(JOB_NOT_EXISTS_ERROR + ":" + job_id)
            job_not_exists = true
        }
    } catch (error) {
        job_internal_error = true
        console.log("job_internal_error")
        console.log(error)
    }
}

function QueryOnce(job_id) {
    var data = { "job_id": parseInt(job_id) }
    fetch(protocol + "://" + host + "/query", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(response => {
        return response.json()
    }).then(mydata => {
        ParseResult(mydata)
    });

}

function Generate(async) {
    var job_id
    var post_data = {
        "width": $("#width").val(),
        "height": $("#height").val(),
        "random_seed": $("#random_seed").val(),
        "negative_prompt": $("#negative_prompt").val(),
        "prompt": $("#prompt").val(),
        "guidance_scale": $("#guidance_scale").val(),
        "steps": $("#steps").val(),
        "n_samples": $("#n_samples").val(),
        "sampler": $("#sampler").val()
    }
    $.ajax({
        type: "post",//request id
        url: protocol + "://" + host + "/generate",
        data: post_data,
        //if no param needed, do not set
        dataType: "json",
        async: async,
        crossDomain: true,
        //请求成功时调用的函数
        success: function (mydata) {
            var request_id = mydata["request_id"]
            var code = mydata["code"]
            if (code != "OK") {
                console.warn(request_id + " failed")
                return
            }
            job_id = mydata["data"]["job_id"]
            queue_len = mydata["data"]["queue_len"]
        }
    }).fail(function (mydata) {
        console.log("failed")
        console.log(mydata)
    })
    return job_id
}

function StepsChange() {
    var value = $("#steps").val();
    document.getElementById('steps_show').innerHTML = value;
}
function GuidanceScaleChange() {
    var value = $("#guidance_scale").val();
    document.getElementById('guidance_scale_show').innerHTML = value;
}
window.document.documentElement.setAttribute("data-theme", "dark");

function Search(search_words, page_num, is_my) {
    is_search = true
    url = "/search?page_size=" + SEARCH_PAGE_SIZE + "&page_num=" + page_num + "&search_words=" + search_words
    if (is_my) {
        url += "&is_my=true"
    }
    var can_continue = true
    $.get(url, function (mydata) {
        try {
            if (mydata.hasOwnProperty("data")) {
                image_details = mydata["data"]["result"]
                if (image_details.length > 0) {
                    ShowImages(image_details)
                } else {
                    can_continue = false
                }
            } else {
                can_continue = false
            }
        }
        catch (error) {
            console.log(error)
            can_continue = false
        }
    })
    return can_continue
}

function LoadGeneratedImages(page_num, is_my) {
    url = "/listImages?page_size=" + PAGE_SIZE + "&page_num=" + page_num + "&is_my=" + is_my
    var can_continue = true
    $.get(url, function (mydata) {
        try {
            if (mydata.hasOwnProperty("data")) {
                image_details = mydata["data"]["result"]
                if (image_details.length > 0) {
                    ShowImages(image_details)
                } else {
                    can_continue = false
                }
            } else {
                can_continue = false
            }
        }
        catch (error) {
            console.log(error)
            can_continue = false
        }
    })
    return can_continue
}

function ShowImages(image_details) {
    image_urls = []
    prompts = []
    job_ids = []
    image_ids = []
    for (var i = 0; i < image_details.length; i++) {
        image_urls.push(image_details[i]["image_url"])
        prompts.push(image_details[i]["prompt"])
        job_ids.push(image_details[i]["job_id"])
        image_ids.push(image_details[i]["image_id"])
    }
    UpdateImages(image_urls, prompts, job_ids, image_ids)
}

function ShortenString(input_str, max_len) {
    if (input_str.length <= max_len) {
        return input_str
    } else {
        return input_str.substring(0, max_len - 3) + "..."
    }
}

$("body").delegate('.img-thumbnail', 'mouseover', function () {
    var this_job_id = $($(this).parents('div').children('#j_span')).text()
    QueryOnce(this_job_id)

})

function GenerateModelParameterDiv(title, text) {
    var d_elem = $("<div></div>")
    d_elem.addClass('row mb-1')
    var title_elem = $("<div></div>")
    title_elem.addClass("row modal-div-block-title")
    var text_elem = $("<div></div>")
    text_elem.addClass("row modal-div-block-text")
    title_elem.append(title)
    text_elem.append(text)
    d_elem.append(title_elem)
    d_elem.append(text_elem)
    return d_elem
}

function GenerateEditorDiv(editor_str) {
    var d_elem = $("<div></div>")
    d_elem.addClass('row')
    var btn_elem = $("<div></div>")
    var s_elem = $("<span></span>")
    s_elem.addClass("bi bi-pencil-square")
    btn_elem.addClass("btn btn-secondary col-sm-8")
    btn_elem.attr("id", "modal-editor")
    btn_elem.append(s_elem)
    btn_elem.append(editor_str)
    d_elem.append(btn_elem)
    return d_elem
}

$("body").delegate('#list-img', 'click', function () {
    $('.modal-image').empty();
    $('#modal-prompt').empty();
    $('#modal-parameters').empty();

    var img_elem = $(this).clone()
    img_elem.removeClass("img-thumbnail")
    img_elem.removeAttr("id")
    img_elem.addClass("modal_img")
    var model_image = $(".modal-image")
    model_image.append(img_elem)
    var txt_elem = $($(this).parents('div').children('#l_span')).clone()
    txt_elem.removeAttr("style")
    txt_elem.attr("id", "l_span_prompt")
    txt_elem.show()
    var model_text = $("#modal-prompt")
    model_text.append(txt_elem)
    var btn_elem = $("#modal_copy")
    btn_elem.empty()
    btn_elem.append("<span class='bi bi-clipboard2'></span> copy prompt")

    parameters_elem = $('#modal-parameters')
    var d_elem = GenerateModelParameterDiv("Seed", random_seed)
    parameters_elem.append(d_elem)
    var d_elem = GenerateModelParameterDiv("Guidance scale", guidance_scale)
    parameters_elem.append(d_elem)
    var d_elem = GenerateModelParameterDiv("Dimensions", width + "x" + height)
    parameters_elem.append(d_elem)
    if (negative_prompt != "") {
        var d_elem = GenerateModelParameterDiv("Negative prompt", negative_prompt)
        parameters_elem.append(d_elem)
    }
    var d_elem = GenerateModelParameterDiv("Sampler", sampler)
    parameters_elem.append(d_elem)
    var d_elem = GenerateModelParameterDiv("Steps", steps)
    parameters_elem.append(d_elem)

    localStorage.setItem("width", width);
    localStorage.setItem("height", height);
    localStorage.setItem("random_seed", random_seed);
    localStorage.setItem("negative_prompt", negative_prompt);
    localStorage.setItem("prompt", prompt_str);
    localStorage.setItem("guidance_scale", guidance_scale);
    localStorage.setItem("steps", steps);
    localStorage.setItem("n_samples", n_samples);
    localStorage.setItem("sampler", sampler);

    $("#imageDetailModal").modal("show")
});

$("body").delegate('#modal-close', 'click', function () {
    $("#imageDetailModal").modal("hide")
});
$("body").delegate('#modal-editor', 'click', function () {
    window.open("editor.html");
});


$("body").delegate('#modal_copy', 'click', function () {
    $('#modal_copy').empty();
    $('#modal_copy').append("<span class='bi bi-clipboard2-check'></span> copied")
    var txt = $('#l_span_prompt').text()
    CopyTextromModal(txt)
})

function CopyTextromModal(text) {
    var textarea = document.createElement("input");//创建input对象
    var currentFocus = document.activeElement;//当前获得焦点的元素
    document.getElementById('modal_copy').appendChild(textarea);//添加元素，如果在模态框下，必须哟个模态框里面的元素
    textarea.value = text;
    textarea.focus();
    textarea.select();
    try {
        var flag = document.execCommand("copy");//执行复制
    } catch (eo) {
        var flag = false;
    }
    document.getElementById('modal_copy').removeChild(textarea);//删除元素
    currentFocus.focus();
    return flag;
}

function GetInfoFromLocalStorage() {
    job_id = localStorage.getItem("job_id");
    width = localStorage.getItem("width");
    height = localStorage.getItem("height");
    random_seed = localStorage.getItem("random_seed");
    negative_prompt = localStorage.getItem("negative_prompt");
    prompt_str = localStorage.getItem("prompt");
    guidance_scale = localStorage.getItem("guidance_scale");
    steps = localStorage.getItem("steps");
    n_samples = localStorage.getItem("n_samples");
    sampler = localStorage.getItem("sampler");
}

function LoginUserNav(user_name, user_id) {
    var register_div_elem = $("#register_div")
    register_div_elem.addClass("d-none")

    var login_div_elem = $("#login_div")
    login_div_elem.addClass("d-none")

    var user_div_elem = $("#logout_div")
    user_div_elem.removeClass("d-none")

    var user_div_elem = $("#user_div")
    user_div_elem.removeClass("d-none")
}

function NotLoginUserNav() {
    var register_div_elem = $("#register_div")
    register_div_elem.removeClass("d-none")

    var login_div_elem = $("#login_div")
    login_div_elem.removeClass("d-none")

    var user_div_elem = $("#user_div")
    user_div_elem.addClass("d-none")

    var user_div_elem = $("#logout_div")
    user_div_elem.addClass("d-none")
}

function ErrorPassword() {
    var u_p_elem = $("#user_passwd_error")
    u_p_elem.removeClass("d-none")
}

function ErrorRegister() {
    var reg_elem = $("#register_error")
    reg_elem.removeClass("d-none")
}
function UpdateSpanContent(element_id, content) {
    document.getElementById(element_id).innerHTML = content
    var elem = $("#" + element_id)
    elem.removeClass("d-none")
}
function ShowNav() {
    $.ajax({
        type: "get",
        url: "/checkLogin",
        dataType: "json",
        async: false,
        crossDomain: true,
        success: function (mydata) {
            if (mydata["data"]["is_login"]) {
                user_name = mydata["data"]["user_name"]
                user_id = mydata["data"]["user_id"]
                LoginUserNav(user_name, user_id)
            } else {
                NotLoginUserNav()
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.warn(XMLHttpRequest.status);
            console.warn(XMLHttpRequest.readyState);
            console.warn(textStatus);
        },
        complete: function (XMLHttpRequest, textStatus) {
            if (XMLHttpRequest.status != 200) {
                console.warn("request complete:" + XMLHttpRequest.status);
            }
        }
    }).fail(function (mydata) {
        console.log("fail")
        console.log(mydata["code"])
        console.log(mydata)
    })

}

$("body").delegate('#login', 'click', function () {
    $("#loginModal").modal("show")
})

$("body").delegate('#register', 'click', function () {
    $("#registerModal").modal("show")
})

$("#register_btn").click(function () {
    var password = $('#register_password').val();
    if ($("#register_username").val().length < 6) {
        UpdateSpanContent("register_error", "username is too short, at least 6 characters")
    } else if (password.length < 6) {
        UpdateSpanContent("register_error", "password is too short, , at least 6 characters")
    } else {
        encrpt_password = md5(password)
        var post_data = {
            "username": $("#register_username").val(),
            "password": encrpt_password
        }
        $.ajax({
            type: "post",
            url: "/register",
            data: post_data,
            dataType: "json",
            async: false,
            crossDomain: true,
            success: function (mydata) {
                try {
                    if (mydata.hasOwnProperty("data")) {
                        if (mydata["data"]["is_login"]) {
                            user_name = mydata["data"]["user_name"]
                            user_id = mydata["data"]["user_id"]
                            $("#registerModal").modal("hide")
                            // location.reload();
                            LoginUserNav(user_name, user_id)
                        } else {
                            UpdateSpanContent("register_error", mydata["message"])
                        }
                    } else {
                        if (mydata["code"] == "USER_EXISTS_ERROR") {
                            UpdateSpanContent("register_error", mydata["message"])
                        } else if (mydata["code"] == "PARAMETER_ERROR") {
                            UpdateSpanContent("register_error", mydata["message"])
                        } else {
                            UpdateSpanContent("register_error", "Internal Error")
                        }
                    }
                } catch (error) {
                    console.log(error)
                    console.log("ErrorInput in exception")
                    ErrorRegister()
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.warn(XMLHttpRequest.status);
                console.warn(XMLHttpRequest.readyState);
                console.warn(textStatus);
            },
            complete: function (XMLHttpRequest, textStatus) {
                if (XMLHttpRequest.status != 200) {
                    console.warn("request complete:" + XMLHttpRequest.status);
                }
            }
        }).fail(function (mydata) {
            console.log("fail")
            console.log(mydata["code"])
            console.log(mydata)
        })
    }
})

$("#login_btn").click(function () {
    encrpt_password = md5($('#login_password').val())
    var post_data = {
        "username": $("#login_username").val(),
        "password": encrpt_password
    }
    $.ajax({
        type: "post",
        url: "/login",
        data: post_data,
        dataType: "json",
        async: false,
        crossDomain: true,
        success: function (mydata) {
            try {
                if (mydata["data"]["is_login"]) {
                    user_name = mydata["data"]["user_name"]
                    user_id = mydata["data"]["user_id"]
                    $("#loginModal").modal("hide")
                    location.reload();
                    // LoginUserNav(user_name, user_id)
                } else {
                    UpdateSpanContent("user_passwd_error", "username and password are not correct")
                }
            } catch (error) {
                console.log(error)
                console.log("ErrorPassword in exception")
                UpdateSpanContent("user_passwd_error", "username and password are not correct")
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.warn(XMLHttpRequest.status);
            console.warn(XMLHttpRequest.readyState);
            console.warn(textStatus);
        },
        complete: function (XMLHttpRequest, textStatus) {
            if (XMLHttpRequest.status != 200) {
                console.warn("request complete:" + XMLHttpRequest.status);
            }
        }
    }).fail(function (mydata) {
        console.log("fail")
        console.log(mydata["code"])
        console.log(mydata)
    })
})

$("#logout").click(function () {
    $.ajax({
        type: "get",
        url: "/logout",
        async: false,
        crossDomain: true,
        success: function (mydata) {
            try {
                if (mydata["data"]["is_login"] != true) {
                    location.reload();
                } else {
                    console.log("got error when logout")
                }
            } catch (error) {
                console.log("got error when logout")
                location.reload();
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.warn(XMLHttpRequest.status);
            console.warn(XMLHttpRequest.readyState);
            console.warn(textStatus);
        },
        complete: function (XMLHttpRequest, textStatus) {
            if (XMLHttpRequest.status != 200) {
                console.warn("request complete:" + XMLHttpRequest.status);
            }
        }
    }).fail(function (mydata) {
        console.log("fail")
        console.log(mydata["code"])
        console.log(mydata)
    })
})

