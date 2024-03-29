
/*
 * click the query button to get the images
 */
const JOB_NOT_EXISTS_ERROR = "JOB_NOT_EXISTS_ERROR"
const INTERNAL_ERROR = "INTERNAL_ERROR"
const CODE_OK = "OK"

const PAGE_SIZE = 30
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
var model_id = "default_model"
var n_samples = undefined
var job_not_exists = false
var job_internal_error = false
var job_id
var image_details = []
var search_words = ""
var is_search = false
var beian = false
var host = window.location.host
protocol = "http"
if (host != "127.0.0.1") {
    protocol = "https"
}
$.ajaxSettings.async = false;
if (document.getElementById("search_words") != null) {
    document.getElementById("search_words").addEventListener('keydown', function (event) {
        if (event.code == 'Enter') {
            $("#search_btn").click()
        }
    })
}
if (document.getElementById("my_search_words") != null) {
    document.getElementById("my_search_words").addEventListener('keydown', function (event) {
        if (event.code == 'Enter') {
            $("#my_search_btn").click()
        }
    })
}
if (document.getElementById("my_fav_search_words") != null) {
    document.getElementById("my_fav_search_words").addEventListener('keydown', function (event) {
        if (event.code == 'Enter') {
            $("#my_fav_search_btn").click()
        }
    })
}


$("#search_btn").click(SearchIndex)
$("#see_more").click(function () {
    $("#login").click()
})

function SearchByPrompt(is_my) {
    Init()
    if (is_my) {
        search_words = $("#my_search_words").val()
    } else {
        search_words = $("#search_words").val()
    }
    EmptyDisplay()
    Search(search_words, page_num, is_my)
    page_num++
}
function SearchIndex() {
    SearchByPrompt(false)
}
function SearchMy() {
    SearchByPrompt(true)
}

$("#my_search_btn").click(SearchMy)

$("#query_btn").click(function () {
    job_id = $("#job_id").val()
    localStorage.setItem("job_id", job_id);
    var reg = /^[0-9]+$/gi
    if (job_id == 0 || !reg.test(job_id)) {
        $("#job_id").val("please input job id")
    } else {
        Init()
        //show and append
        var is_append = true
        var is_show = true
        QueryOnce(job_id, is_show, is_append)
    }
})

$("#generate_btn").click(function () {
    if (IsLogin()) {
        if ($("#prompt").val() == "") {
            console.warn("please input prompt")
            $("#prompt").focus()
        } else {
            GenerateInitilize()
            job_id = Generate()
            if (job_id != undefined) {
                if (query_interval_id != undefined) {
                    clearInterval(query_interval_id)
                }
                //show but prepand
                var is_append = false
                var is_show = true
                QueryOnce(job_id, is_show, is_append)
                var x = 1000
                query_interval_id = setInterval("QueryOnce(" + job_id + ", " + is_show + ", " + is_append + ")", x);
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
    localStorage.clear()
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
function LoadMyFavoritesPage() {
    ShowNav()
    if (!IsLogin()) {
        $("#loginModal").modal("show")
    } else {
        page_num = 1
        for (start_page_num = 1; page_num < start_page_num + 1; page_num++) {
            var continued = LoadMyFavoriteImages(page_num)
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
    if (scrollTop + clientHeight >= scrollHeight - 20) {
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
    login_info = CheckLogin()
    if (login_info.hasOwnProperty("is_login")) {
        return login_info["is_login"]
    } else {
        return false
    }
}

function IsAdmin() {
    login_info = CheckLogin()
    if (login_info.hasOwnProperty("is_admin")) {
        return login_info["is_admin"]
    } else {
        return false
    }
}

function CheckLogin() {
    var login_info
    $.get("/checkLogin", function (data) {
        try {
            if (data.hasOwnProperty("data")) {
                login_info = data["data"]
            } else {
                login_info["is_login"] = false
            }
        } catch (error) {
            console.log(error)
            login_info["is_login"] = false
        }
    })
    return login_info
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
    model_id = "default_model"
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
        width = 512
        $("#width").val(width)
    } else if ($("#width").val() % 8 != 0) {
        temp = parseInt($("#width").val() / 8)
        $("#width").val(temp * 8)
    }
    if ($("#height").val() == "" || $("#height").val() == 0) {
        height = 512
        $("#height").val(height)
    } else if ($("#height").val() % 8 != 0) {
        temp = parseInt($("#height").val() / 8)
        $("#height").val(temp * 8)
    }
    if ($("#steps").val() == "" || $("#steps").val() == 0) {
        steps = 50
        $("#steps").val(steps)
    }
    if ($("#n_samples").val() == "" || $("#n_samples").val() == 0 || $("#n_samples").val() > 6) {
        n_samples = 6
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
    //for model id
    if ($("input:radio:checked").val() == undefined) {
        $('input:radio[value=default_model]').attr('checked', 'true');
    }
}

function EmptyQueue() {
    $("#queue_div").empty()
}
function EmptyRow() {
    $("#row_div").empty()
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
}
function DisplayError() {
    var queue_div = $("<div></div>")
    queue_div.attr("id", "queue_div")

    q_text = "<p>Internal Error</p>"
    queue_div.append($(q_text))
}

function DisplayInProgress(n) {
    var queue_div = $("#queue_div")
    queue_div.empty()
    var tmp = ""
    for (var i = 0; i < n; i++) {
        tmp += "."
    }
    queue_div.append($("<p>current request is processing" + tmp + "</p>"))
}

function DisplayQueue(n) {
    var queue_div = $("#queue_div")
    queue_div.empty()
    queue_div.append($("<p>current request is order <red>" + n + "</red></p>"))
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
    if (steps != "undefined") {
        document.getElementById('steps_show').innerHTML = steps;
    }
    if (guidance_scale != "undefined") {
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
    $("input:radio[value='" + model_id + "']").attr('checked', 'true');
}

function UpdateElementValue(element, value) {
    if (typeof (value) != "undefined") {
        $(element).val(value)
    }

}
function UpdateImages(image_urls, prompts, job_ids, image_ids, is_append) {
    var row_photos = $("#row_div")
    var div_elems = new Array(image_urls.length)
    is_login = IsLogin()
    for (var i = 0; i < image_urls.length; i++) {
        var image_index = i
        if (is_append == false) {
            image_index = image_urls.length - i - 1
        }
        div_elems[i] = $("<div></div>")
        div_elems[i].addClass("col-sm-3 col-md-2 col-lg-2 mb-1 item")
        div_elems[i].attr("align", "center")
        div_elems[i].attr("id", "album_" + image_ids[image_index])
        var i_span_elem = $("<span>" + image_ids[image_index] + "</span>")
        i_span_elem.attr("id", "i_span")
        i_span_elem.hide()
        div_elems[i].append(i_span_elem)

        if (job_ids != undefined) {
            var j_span_elem = $("<span>" + job_ids[image_index] + "</span>")
            j_span_elem.attr("id", "j_span")
            j_span_elem.hide()
            div_elems[i].append(j_span_elem)
        }
        var fav_btn_elem = $("<div></div>")
        fav_btn_elem.attr("id", "fav_" + image_ids[image_index])
        fav_btn_elem.addClass("fav-button")
        fav_btn_elem.attr("title", "favorite")
        div_elems[i].append(fav_btn_elem)


        if (is_login) {
            post_data = {
                "image_id": image_ids[i],
            }
            $.ajax({
                type: "post",
                url: "/isFavorite",
                data: post_data,
                dataType: "json",
                async: true,
                crossDomain: true,
                success: function (ret_data) {
                    if (ret_data["message"] == "success") {
                        this_image_id = ret_data["data"]["image_id"]
                        fav_btn_elem = $("#fav_" + this_image_id)
                        if (ret_data["data"]["is_fav"] == true) {
                            fav_btn_elem.append("<i class='bi bi-heart-fill fav'></i>")
                        } else {
                            fav_btn_elem.append("<i class='bi bi-heart'></i>")
                        }
                        // div_elem = $("#album_" + this_image_id)
                        // console.log("#album_" + this_image_id)
                        // div_elem.append(fav_btn_elem)
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
            }).fail(function (ret_data) {
                // div_elem = $("#album_" + image_ids[i])
                // console.log("#album2_" + image_ids[i])
                div_elem.append(fav_btn_elem)
                console.log("fail")
                console.log(ret_data["code"])
                console.log(ret_data)
            })
        } else {
            fav_btn_elem.append("<i class='bi bi-heart'></i>")
        }

        var image_url = image_urls[image_index]
        var a_elem = $("<a></a>")
        a_elem.attr("data-lightbox", "photos")
        image_elem = $("<img>")
        image_elem.addClass("img-fluid img-thumbnail")
        image_elem.attr("src", image_url)
        image_elem.attr("id", "list-img")
        a_elem.append(image_elem)
        div_elems[i].append(a_elem)
        if (prompts != undefined) {
            if (Array.isArray(prompts)) {
                var s_span_elem = $("<span>" + ShortenString(prompts[i], MAX_PROMPT_DISPLAY_LENGTH) + "</span>")
                div_elems[i].append(s_span_elem)
                var l_span_elem = $("<span>" + prompts[i] + "</span>")
                l_span_elem.attr("id", "l_span")
                l_span_elem.hide()
                div_elems[i].append(l_span_elem)
            } else {
                var s_span_elem = $("<span>" + ShortenString(prompts, MAX_PROMPT_DISPLAY_LENGTH) + "</span>")
                div_elems[i].append(s_span_elem)
                var l_span_elem = $("<span>" + prompts + "</span>")
                l_span_elem.attr("id", "l_span")
                l_span_elem.hide()
                div_elems[i].append(l_span_elem)
            }
        }

        if (is_append) {
            row_photos.append(div_elems[i])
        } else {
            row_photos.prepend(div_elems[i])
        }
    }
}

function ShowQueryResult(mydata, is_show, is_append) {
    if (is_show) {
        EmptyQueue()
        if (is_append) {
            EmptyRow()
        }
    }
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
            model_id = mydata["data"]["result"]["model_id"]
            sampler = mydata["data"]["result"]["sampler"]
            n_samples = mydata["data"]["result"]["n_samples"]
            job_id = mydata["data"]["result"]['job_id']
            job_not_exists = false
            image_details = mydata["data"]["images"]

            if (is_show) {
                DisplayQueryInfo()
                if (state == 0) {
                    DisplayQueue(queue_len)
                } else if (state == 1) {
                    DisplayInProgress(query_times++)
                } else if (state == 2) {
                    ShowImages(image_details, false, is_append)
                    clearInterval(query_interval_id)
                } else if (state == 3) {
                    DisplayError()
                    clearInterval(query_interval_id)
                }
            }
        } else if (code == JOB_NOT_EXISTS_ERROR) {
            console.log(JOB_NOT_EXISTS_ERROR + ":" + job_id)
            if (is_show == true) {
                DisplayJobNotExists(job_id)
                clearInterval(query_interval_id)
            }
        }
    } catch (error) {
        job_internal_error = true
        console.log("job_internal_error")
        console.log(error)
        if (is_show == true) {
            DisplayError()
            clearInterval(query_interval_id)
        }
    }
}

function QueryOnce(job_id, is_show, is_append) {
    var post_data = { "job_id": parseInt(job_id) }
    $.post("/query", post_data, function (mydata) {
        try {
            ShowQueryResult(mydata, is_show, is_append)
        } catch (error) {
            console.log(error)
        }
    })
}

function Generate() {
    var job_id
    width = $("#width").val()
    height = $("#height").val()
    random_seed = $("#random_seed").val()
    negative_prompt = $("#negative_prompt").val()
    prompt_str = $("#prompt").val()
    guidance_scale = $("#guidance_scale").val()
    steps = $("#steps").val()
    n_samples = $("#n_samples").val()
    sampler = $("#sampler").val()
    model_id = $("input:radio:checked").val()
    var post_data = {
        "width": width,
        "height": height,
        "random_seed": random_seed,
        "negative_prompt": negative_prompt,
        "prompt": prompt_str,
        "guidance_scale": guidance_scale,
        "steps": steps,
        "n_samples": n_samples,
        "sampler": sampler,
        "model_id": model_id
    }
    localStorage.setItem("width", width);
    localStorage.setItem("height", height);
    localStorage.setItem("random_seed", random_seed);
    localStorage.setItem("negative_prompt", negative_prompt);
    localStorage.setItem("prompt", prompt_str);
    localStorage.setItem("guidance_scale", guidance_scale);
    localStorage.setItem("steps", steps);
    localStorage.setItem("n_samples", n_samples);
    localStorage.setItem("sampler", sampler);
    localStorage.setItem("model_id", model_id);
    $.post("/generate", post_data, function (mydata) {
        try {
            var request_id = mydata["request_id"]
            var code = mydata["code"]
            job_id = mydata["data"]["job_id"]
            queue_len = mydata["data"]["queue_len"]
            if (code != "OK") {
                console.warn(request_id + " failed")
            }
        } catch (error) {
            console.log(error)
            console.log(mydata)
        }
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
    if (is_my == true) {
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

function LoadMyFavoriteImages(page_num) {
    var can_continue = true
    post_data = {
        "page_num": page_num,
        "page_size": PAGE_SIZE
    }
    $.post("/favoriteImages", post_data, function (mydata) {
        try {
            if (mydata.hasOwnProperty("data")) {
                image_details = mydata["data"]["result"]
                if (image_details.length > 0) {
                    ShowImages(image_details, false)
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

function ShowImages(show_image_details, index = true, is_append = true) {
    image_urls = []
    prompts = []
    job_ids = []
    image_ids = []
    for (var i = 0; i < show_image_details.length; i++) {
        if (index) {
            image_ids.push(show_image_details[i]["cover_image_id"])
            image_urls.push(show_image_details[i]["cover_image_url"])
        } else {
            image_ids.push(show_image_details[i]["image_id"])
            image_urls.push(show_image_details[i]["image_url"])
        }
        prompts.push(show_image_details[i]["prompt"])
        job_ids.push(show_image_details[i]["job_id"])
    }
    UpdateImages(image_urls, prompts, job_ids, image_ids, is_append)
}

function ShortenString(input_str, max_len) {
    if (input_str.length <= max_len) {
        return input_str
    } else {
        return input_str.substring(0, max_len - 3) + "..."
    }
}

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

$("body").delegate('.small_modal_img', 'click', function () {
    $(this).css("opacity", "1").siblings().css("opacity", "0.4");
    src_url = $(this).attr("src")
    $("#focus_image").attr("src", src_url)
    this_image_id = $(this).attr("id")
    UpdateSpanContent("image_id_span", this_image_id)
    post_data = {
        "image_id": this_image_id,
    }
    $.post("/isFavorite", post_data, function (ret_data) {
        if (ret_data["message"] == "success") {
            if (ret_data["data"]["is_fav"] == true) {
                $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                $('#span_fav').addClass("bi-heart-fill fav")
            } else {
                $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                $('#span_fav').addClass("bi-heart")
            }
        } else {
            $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
            $('#span_fav').addClass("bi-heart")
        }
    })
})

$("body").delegate('#list-img', 'click', function () {
    $('.modal-image').empty();
    $('#modal-prompt').empty();
    $('#modal-parameters').empty();

    var this_job_id = $($(this).parents('div').children('#j_span')).text()
    var this_image_id = $($(this).parents('div').children('#i_span')).text()
    var is_show = false
    var is_append = false
    QueryOnce(this_job_id, is_show, is_append)

    var img_div = $("<div></div>")
    var img_elem = $(this).clone()
    img_elem.removeClass("img-thumbnail")
    img_elem.removeAttr("id")
    img_elem.attr("id", "focus_image")
    img_elem.addClass("modal_img")

    img_div.append(img_elem)
    var model_image = $(".modal-image")
    model_image.append(img_div)
    var small_imgs_div = $("<div class='mt-2'></div>")
    for (i = 0; i < image_details.length; i++) {
        if (image_details[i]["image_id"] == this_image_id) {
            var small_image = $("<img></img>")
            small_image.addClass("small_modal_img")
            small_image.attr("src", image_details[i]["image_url"])
            small_image.attr("id", image_details[i]["image_id"])
            small_imgs_div.append(small_image)
        } else {
            continue
        }
    }
    for (i = 0; i < image_details.length; i++) {
        if (image_details[i]["image_id"] == this_image_id) {
            continue
        } else {
            var small_image = $("<img></img>")
            small_image.addClass("small_modal_img small_modal_img_dark")
            small_image.attr("src", image_details[i]["image_url"])
            small_image.attr("id", image_details[i]["image_id"])
            small_imgs_div.append(small_image)
        }
    }
    model_image.append(small_imgs_div)

    var prompt_elem = $("<span>" + prompt_str + "</span>")
    prompt_elem.attr("id", "l_span_prompt")

    var job_id_elem = $($(this).parents('div').children('#j_span')).clone()
    job_id_elem.removeAttr("style")
    job_id_elem.attr("id", "job_id_span")
    job_id_elem.hide()
    var image_id_elem = $($(this).parents('div').children('#i_span')).clone()
    image_id_elem.removeAttr("style")
    image_id_elem.attr("id", "image_id_span")
    image_id_elem.hide()
    var model_text = $("#modal-prompt")
    model_text.append(prompt_elem)
    model_text.append(job_id_elem)
    model_text.append(image_id_elem)
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
    var d_elem = GenerateModelParameterDiv("model_id", model_id)
    parameters_elem.append(d_elem)

    var job_id = $('#job_id_span').text()
    localStorage.setItem("job_id", job_id);
    localStorage.setItem("width", width);
    localStorage.setItem("height", height);
    localStorage.setItem("random_seed", random_seed);
    localStorage.setItem("negative_prompt", negative_prompt);
    localStorage.setItem("prompt", prompt_str);
    localStorage.setItem("guidance_scale", guidance_scale);
    localStorage.setItem("steps", steps);
    localStorage.setItem("n_samples", n_samples);
    localStorage.setItem("sampler", sampler);
    localStorage.setItem("model_id", model_id);

    // check whether image is favorite
    if (IsLogin()) {
        var image_id = $('#image_id_span').text()
        post_data = {
            "image_id": image_id,
        }
        if (IsAdmin()) {
            var ban_elem = $("#modal_ban")
            ban_elem.removeClass("d-none")
            $.ajax({
                type: "post",
                url: "/isBan",
                data: post_data,
                dataType: "json",
                async: true,
                crossDomain: true,
                success: function (ret_data) {
                    if (ret_data["message"] == "success") {
                        if (ret_data["data"]["is_ban"] == true) {
                            $('#span_ban').removeClass("bi-eye bi-eye-slash")
                            $('#span_ban').addClass("bi-eye-slash")
                        } else {
                            $('#span_ban').removeClass("bi-eye bi-eye-slash")
                            $('#span_ban').addClass("bi-eye")
                        }
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
            }).fail(function (ret_data) {
                $('#span_ban').removeClass("bi-eye bi-eye-slash")
                $('#span_ban').addClass("bi-eye")
                console.log("fail")
                console.log(ret_data["code"])
                console.log(ret_data)
            })
        }
        $.ajax({
            type: "post",
            url: "/isFavorite",
            data: post_data,
            dataType: "json",
            async: true,
            crossDomain: true,
            success: function (ret_data) {
                if (ret_data["message"] == "success") {
                    if (ret_data["data"]["is_fav"] == true) {
                        $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                        $('#span_fav').addClass("bi-heart-fill fav")
                    } else {
                        $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                        $('#span_fav').addClass("bi-heart")
                    }
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
        }).fail(function (ret_data) {
            $('#span_fav').removeClass("bi-heart bi-heart-fill")
            $('#span_fav').addClass("bi-heart")
            console.log("fail")
            console.log(ret_data["code"])
            console.log(ret_data)
        })
    } else {
        $('#span_fav').removeClass("bi-heart bi-heart-fill")
        $('#span_fav').addClass("bi-heart")
    }

    $("#imageDetailModal").modal("show")
});

$("body").delegate('#modal-close', 'click', function () {
    $("#imageDetailModal").modal("hide")
});
$("body").delegate('#modal-editor', 'click', function () {
    window.open("editor.html");
});
$('#gen_btn').click(function () {
    localStorage.setItem("prompt", $("#search_words").val());
    console.log("search_words:" + $("#search_words").val())
    window.open("editor.html");
});

$("body").delegate('#modal_copy', 'click', function () {
    $('#modal_copy').empty();
    var txt = $('#l_span_prompt').text()
    CopyTextromModal(txt)
    $('#modal_copy').append("<span class='bi bi-clipboard2-check'>copied</span>")
})
$("body").delegate('#modal_ban', 'click', function () {
    var image_id = $('#image_id_span').text()
    var class_name = $('#span_ban').attr("class")
    if (IsAdmin()) {
        if (class_name == "bi bi-eye") {
            post_data = {
                "image_id": image_id,
                "is_ban": true
            }
            $.post("/ban", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        $('#span_ban').removeClass("bi-eye bi-eye-slash")
                        $('#span_ban').addClass("bi-eye-slash")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        } else {
            post_data = {
                "image_id": image_id,
                "is_ban": false
            }
            $.post("/ban", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        $('#span_ban').removeClass("bi-eye bi-eye-slash")
                        $('#span_ban').addClass("bi-eye")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        }
    } else {
        $("#loginModal").modal("show")
    }
})

$("body").delegate('.bi', 'click', ClickFavIcon)

function ClickFavIcon() {
    this_li = $(this)
    var image_id = this_li.parents('div').attr("id").split('_')[1]
    var class_name = this_li.attr("class")
    if (IsLogin()) {
        if (class_name == "bi bi-heart") {
            post_data = {
                "image_id": image_id,
                "is_fav": true
            }
            $.post("/favorite", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        this_li.removeClass("bi-heart bi-heart-fill fav")
                        this_li.addClass("bi-heart-fill fav")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        } else {
            post_data = {
                "image_id": image_id,
                "is_fav": false
            }
            $.post("/favorite", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        this_li.removeClass("bi-heart bi-heart-fill fav")
                        this_li.addClass("bi-heart")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        }
    } else {
        $("#loginModal").modal("show")
    }
}

function ClickModalFav() {
    var image_id = $('#image_id_span').text()
    var class_name = $('#span_fav').attr("class")
    if (IsLogin()) {
        if (class_name == "bi bi-heart") {
            post_data = {
                "image_id": image_id,
                "is_fav": true
            }
            $.post("/favorite", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                        $('#span_fav').addClass("bi-heart-fill fav")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        } else {
            post_data = {
                "image_id": image_id,
                "is_fav": false
            }
            $.post("/favorite", post_data, function (data) {
                try {
                    if (data["message"] == "success") {
                        $('#span_fav').removeClass("bi-heart bi-heart-fill fav")
                        $('#span_fav').addClass("bi-heart")
                    } else {
                        console.warn(data["message"])
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        }
    } else {
        $("#loginModal").modal("show")
    }
}

$("body").delegate('#modal_favorite', 'click', ClickModalFav)

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
    prompt_str = localStorage.getItem("prompt");
    if (prompt_str == null) {
        Init()
    } else {
        width = localStorage.getItem("width");
        height = localStorage.getItem("height");
        random_seed = localStorage.getItem("random_seed");
        negative_prompt = localStorage.getItem("negative_prompt");
        prompt_str = localStorage.getItem("prompt");
        guidance_scale = localStorage.getItem("guidance_scale");
        steps = localStorage.getItem("steps");
        n_samples = localStorage.getItem("n_samples");
        sampler = localStorage.getItem("sampler");
        model_id = localStorage.getItem("model_id");
    }
}

function LoginUserNav(user_name, user_id) {
    var register_div_elem = $("#register_div")
    register_div_elem.addClass("d-none")

    var login_div_elem = $("#login_div")
    login_div_elem.addClass("d-none")

    var user_div_elem = $("#dropdown_home_div")
    user_div_elem.removeClass("d-none")
}

function NotLoginUserNav() {
    var register_div_elem = $("#register_div")
    register_div_elem.removeClass("d-none")

    var login_div_elem = $("#login_div")
    login_div_elem.removeClass("d-none")

    var user_div_elem = $("#dropdown_home_div")
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

                document.getElementById('dropdownMenuButton').innerHTML = user_name + "'s Home"
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

