



"use strict";

/* =========================================================
   HR MATKA BACKEND
   COMPLETE REPLACEMENT
   PART 1 OF 5

   CORE:
   - HTTP SERVER
   - SOURCE SECURITY
   - TEXT HELPERS
   - JSON HELPERS
   - SERVER SIDE FETCH
   - DATE HELPERS
========================================================= */

const http = require("http");
const https = require("https");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");


/* =========================================================
   SERVER CONFIG
========================================================= */

const HOST = "127.0.0.1";
const PORT = 5000;


/* =========================================================
   ALLOWED SOURCE HOSTS

   Sirf in approved hosts ko backend fetch karega.
========================================================= */

const ALLOWED_HOSTS = new Set([

    "dpbosssss.boston",
    "www.dpbosssss.boston",

    "sattamatkadpboss.mobi",
    "www.sattamatkadpboss.mobi",

    "spmatka.net",
    "www.spmatka.net",

    "mail.spmatka.net"

]);


/* =========================================================
   BASIC TEXT HELPERS
========================================================= */

function cleanText(value){

    return String(
        value ?? ""
    )
    .replace(
        /\u00a0/g,
        " "
    )
    .replace(
        /\r/g,
        " "
    )
    .replace(
        /\n/g,
        " "
    )
    .replace(
        /\t/g,
        " "
    )
    .replace(
        /\s+/g,
        " "
    )
    .trim();

}


function upper(value){

    return cleanText(
        value
    )
    .toUpperCase();

}


function digitsOnly(value){

    return String(
        value ?? ""
    )
    .replace(
        /\D/g,
        ""
    );

}


function normalizeMarketName(value){

    return upper(
        value
    )
    .replace(
        /[^A-Z0-9]+/g,
        " "
    )
    .replace(
        /\s+/g,
        " "
    )
    .trim();

}


/* =========================================================
   RESULT VALIDATORS
========================================================= */

function validPanel(value){

    return /^\d{3}$/.test(
        cleanText(
            value
        )
    );

}


function validJodi(value){

    return /^\d{2}$/.test(
        cleanText(
            value
        )
    );

}


function validSingle(value){

    return /^\d$/.test(
        cleanText(
            value
        )
    );

}


/* =========================================================
   PANEL -> SINGLE

   Example:
   470
   4+7+0 = 11
   single = 1
========================================================= */

function calculateSingle(panel){

    const digits =
        digitsOnly(
            panel
        );


    if(
        !/^\d{3}$/.test(
            digits
        )
    ){

        return "";

    }


    let total = 0;


    for(
        const digit of digits
    ){

        total +=
            Number(
                digit
            );

    }


    return String(
        total % 10
    );

}


/* =========================================================
   HTML ENTITY DECODE
========================================================= */

function decodeHtml(value){

    return String(
        value ?? ""
    )
    .replace(
        /&nbsp;/gi,
        " "
    )
    .replace(
        /&#160;/gi,
        " "
    )
    .replace(
        /&amp;/gi,
        "&"
    )
    .replace(
        /&quot;/gi,
        '"'
    )
    .replace(
        /&#39;/gi,
        "'"
    )
    .replace(
        /&lt;/gi,
        "<"
    )
    .replace(
        /&gt;/gi,
        ">"
    )
    .replace(
        /&#x2F;/gi,
        "/"
    )
    .replace(
        /&#47;/gi,
        "/"
    );

}


/* =========================================================
   HTML -> CLEAN TEXT
========================================================= */

function stripTags(value){

    let html =
        String(
            value ?? ""
        );


    html =
        html
        .replace(
            /<script[\s\S]*?<\/script>/gi,
            " "
        )
        .replace(
            /<style[\s\S]*?<\/style>/gi,
            " "
        )
        .replace(
            /<br\b[^>]*>/gi,
            " "
        )
        .replace(
            /<\/p>/gi,
            " "
        )
        .replace(
            /<\/div>/gi,
            " "
        )
        .replace(
            /<\/span>/gi,
            " "
        )
        .replace(
            /<[^>]+>/g,
            " "
        );


    return cleanText(
        decodeHtml(
            html
        )
    );

}


/* =========================================================
   JSON RESPONSE
========================================================= */

function sendJson(
    res,
    statusCode,
    data
){

    if(
        res.headersSent
    ){

        try{
            res.end();
        }
        catch(error){
            console.error(
                "Response End Error:",
                error
            );
        }

        return;
    }


    const output =
        JSON.stringify(
            data
        );


    res.writeHead(
        statusCode,
        {

            "Content-Type":
                "application/json; charset=utf-8",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type",

            "Cache-Control":
                "no-store"

        }
    );


    res.end(
        output
    );

}


/* =========================================================
   READ JSON REQUEST BODY
========================================================= */

function readJsonBody(req){

    return new Promise(
        function(resolve,reject){

            let body = "";
            let completed = false;


            req.on(
                "data",
                function(chunk){

                    if(completed){
                        return;
                    }


                    body +=
                        chunk.toString();


                    if(
                        Buffer.byteLength(
                            body,
                            "utf8"
                        )
                        >
                        1024 * 1024
                    ){

                        completed = true;

                        reject(
                            new Error(
                                "Request too large"
                            )
                        );

                        req.destroy();
                    }

                }
            );


            req.on(
                "end",
                function(){

                    if(completed){
                        return;
                    }


                    completed = true;


                    if(
                        !body.trim()
                    ){

                        resolve(
                            {}
                        );

                        return;
                    }


                    try{

                        const parsed =
                            JSON.parse(
                                body
                            );


                        resolve(
                            parsed
                        );

                    }
                    catch(error){

                        reject(
                            new Error(
                                "Invalid JSON body"
                            )
                        );

                    }

                }
            );


            req.on(
                "error",
                function(error){

                    if(completed){
                        return;
                    }


                    completed = true;

                    reject(
                        error
                    );

                }
            );

        }
    );

}


/* =========================================================
   NORMALIZE SOURCE URL

   Browser field se accidental spaces ya quotes
   remove karega.
========================================================= */

function normalizeSourceUrl(value){

    let raw =
        String(
            value ?? ""
        )
        .trim();


    /*
       Accidental surrounding quotes remove.
    */

    if(
        (
            raw.startsWith('"')
            &&
            raw.endsWith('"')
        )
        ||
        (
            raw.startsWith("'")
            &&
            raw.endsWith("'")
        )
    ){

        raw =
            raw.slice(
                1,
                -1
            )
            .trim();

    }


    /*
       Invisible Unicode spaces remove.
    */

    raw =
        raw
        .replace(
            /[\u200B-\u200D\uFEFF]/g,
            ""
        )
        .trim();


    return raw;

}


/* =========================================================
   URL VALIDATION
========================================================= */

function validateSourceUrl(value){

    const raw =
        normalizeSourceUrl(
            value
        );


    if(!raw){

        throw new Error(
            "Source URL Required"
        );

    }


    let parsed;


    try{

        parsed =
            new URL(
                raw
            );

    }
    catch(error){

        throw new Error(
            "Invalid Source URL"
        );

    }


    /*
       Security rule:
       external historical/live source HTTPS hi hoga.
    */

    if(
        String(
            parsed.protocol
        )
        .toLowerCase()
        !==
        "https:"
    ){

        throw new Error(
            "Only HTTPS URL Allowed"
        );

    }


    const hostname =
        String(
            parsed.hostname || ""
        )
        .toLowerCase();


    if(
        !ALLOWED_HOSTS.has(
            hostname
        )
    ){

        throw new Error(
            "Source Domain Not Allowed: "
            +
            hostname
        );

    }


    /*
       Username/password embedded URL reject.
    */

    if(
        parsed.username
        ||
        parsed.password
    ){

        throw new Error(
            "Source URL Authentication Not Allowed"
        );

    }


    return parsed.toString();

}


/* =========================================================
   FETCH EXTERNAL HTML

   Server-side fetch:
   browser CORS problem nahi hogi.
========================================================= */

function fetchHtml(
    url,
    redirectCount = 0
){

    return new Promise(
        function(resolve,reject){

            if(
                redirectCount > 5
            ){

                reject(
                    new Error(
                        "Too many redirects"
                    )
                );

                return;
            }


            let safeUrl;


            try{

                safeUrl =
                    validateSourceUrl(
                        url
                    );

            }
            catch(error){

                reject(
                    error
                );

                return;
            }


            let completed = false;


            const options = {

                headers:{

                    "User-Agent":
                        "Mozilla/5.0 "
                        +
                        "(Windows NT 10.0; Win64; x64) "
                        +
                        "AppleWebKit/537.36 "
                        +
                        "(KHTML, like Gecko) "
                        +
                        "Chrome/140.0 Safari/537.36",

                    "Accept":
                        "text/html,"
                        +
                        "application/xhtml+xml,"
                        +
                        "application/xml;q=0.9,"
                        +
                        "*/*;q=0.8",

                    "Accept-Language":
                        "en-IN,en-US;q=0.9,en;q=0.8",

                    "Cache-Control":
                        "no-cache",

                    "Pragma":
                        "no-cache",

                    "Connection":
                        "close"

                },

                timeout:
                    20000

            };


            const request =
                https.get(
                    safeUrl,
                    options,
                    function(response){

                        /* =================================
                           REDIRECT
                        ================================= */

                        if(
                            response.statusCode >= 300
                            &&
                            response.statusCode < 400
                            &&
                            response.headers.location
                        ){

                            let redirectUrl;


                            try{

                                redirectUrl =
                                    new URL(
                                        response.headers.location,
                                        safeUrl
                                    )
                                    .toString();

                            }
                            catch(error){

                                response.resume();


                                if(!completed){

                                    completed = true;

                                    reject(
                                        new Error(
                                            "Invalid Redirect URL"
                                        )
                                    );

                                }


                                return;
                            }


                            response.resume();


                            fetchHtml(
                                redirectUrl,
                                redirectCount + 1
                            )
                            .then(
                                function(html){

                                    if(completed){
                                        return;
                                    }


                                    completed = true;

                                    resolve(
                                        html
                                    );

                                }
                            )
                            .catch(
                                function(error){

                                    if(completed){
                                        return;
                                    }


                                    completed = true;

                                    reject(
                                        error
                                    );

                                }
                            );


                            return;
                        }


                        /* =================================
                           HTTP ERROR
                        ================================= */

                        if(
                            response.statusCode !== 200
                        ){

                            const statusCode =
                                Number(
                                    response.statusCode || 0
                                );


                            response.resume();


                            if(!completed){

                                completed = true;

                                reject(
                                    new Error(
                                        "Source HTTP "
                                        +
                                        statusCode
                                    )
                                );

                            }


                            return;
                        }


                        let html = "";


                        response.setEncoding(
                            "utf8"
                        );


                        response.on(
                            "data",
                            function(chunk){

                                if(completed){
                                    return;
                                }


                                html +=
                                    chunk;


                                if(
                                    Buffer.byteLength(
                                        html,
                                        "utf8"
                                    )
                                    >
                                    8 * 1024 * 1024
                                ){

                                    completed = true;

                                    request.destroy();


                                    reject(
                                        new Error(
                                            "Source page too large"
                                        )
                                    );

                                }

                            }
                        );


                        response.on(
                            "end",
                            function(){

                                if(completed){
                                    return;
                                }


                                completed = true;

                                resolve(
                                    html
                                );

                            }
                        );


                        response.on(
                            "error",
                            function(error){

                                if(completed){
                                    return;
                                }


                                completed = true;

                                reject(
                                    error
                                );

                            }
                        );

                    }
                );


            request.on(
                "timeout",
                function(){

                    if(completed){
                        return;
                    }


                    completed = true;

                    request.destroy();


                    reject(
                        new Error(
                            "Source request timeout"
                        )
                    );

                }
            );


            request.on(
                "error",
                function(error){

                    if(completed){
                        return;
                    }


                    completed = true;

                    reject(
                        error
                    );

                }
            );

        }
    );

}


/* =========================================================
   SAFE DATE CREATOR
========================================================= */

function createSafeDate(
    day,
    month,
    year
){

    day =
        Number(
            day
        );


    month =
        Number(
            month
        );


    year =
        Number(
            year
        );


    if(
        !Number.isInteger(day)
        ||
        !Number.isInteger(month)
        ||
        !Number.isInteger(year)
    ){

        return null;
    }


    /*
       26 -> 2026
       18 -> 2018
    */

    if(
        year >= 0
        &&
        year < 100
    ){

        year += 2000;
    }


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    if(
        Number.isNaN(
            date.getTime()
        )
    ){

        return null;
    }


    if(
        date.getFullYear() !== year
        ||
        date.getMonth() !== month - 1
        ||
        date.getDate() !== day
    ){

        return null;
    }


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;

}


/* =========================================================
   PARSE DISPLAY DATE

   Supports:
   DD/MM/YYYY
   DD-MM-YYYY
   DD/MM/YY
   DD-MM-YY
========================================================= */

function parseDate(value){

    const raw =
        cleanText(
            value
        );


    const match =
        raw.match(
            /(^|\D)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})(?!\d)/
        );


    if(!match){

        return null;
    }


    return createSafeDate(

        match[2],

        match[3],

        match[4]

    );

}


/* =========================================================
   API DATE

   Supports:
   YYYY-MM-DD
   DD/MM/YYYY
   DD-MM-YYYY
========================================================= */

function parseApiDate(value){

    const raw =
        cleanText(
            value
        );


    if(!raw){

        return null;
    }


    const iso =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );


    if(iso){

        return createSafeDate(

            iso[3],

            iso[2],

            iso[1]

        );
    }


    return parseDate(
        raw
    );

}


/* =========================================================
   FORMAT DATE -> DD/MM/YYYY
========================================================= */

function formatDate(date){

    if(
        !(date instanceof Date)
        ||
        Number.isNaN(
            date.getTime()
        )
    ){

        return "";
    }


    const day =
        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        );


    const month =
        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    return (
        day
        +
        "/"
        +
        month
        +
        "/"
        +
        date.getFullYear()
    );

}


/* =========================================================
   ADD DAYS
========================================================= */

function addDays(
    date,
    days
){

    const output =
        new Date(
            date.getTime()
        );


    output.setDate(
        output.getDate()
        +
        Number(
            days || 0
        )
    );


    output.setHours(
        0,
        0,
        0,
        0
    );


    return output;

}


/* =========================================================
   START OF DAY
========================================================= */

function startOfDay(date){

    const output =
        new Date(
            date
        );


    output.setHours(
        0,
        0,
        0,
        0
    );


    return output;

}


/* =========================================================
   RANGE CHECK
========================================================= */

function inRange(
    date,
    fromDate,
    toDate
){

    if(
        !(date instanceof Date)
        ||
        !(fromDate instanceof Date)
        ||
        !(toDate instanceof Date)
    ){

        return false;
    }


    const current =
        startOfDay(
            date
        )
        .getTime();


    const from =
        startOfDay(
            fromDate
        )
        .getTime();


    const to =
        startOfDay(
            toDate
        )
        .getTime();


    return (
        current >= from
        &&
        current <= to
    );

}


/* =========================================================
   DEFAULT HISTORY RANGE
========================================================= */

function defaultHistoryFrom(){

    const date =
        new Date(
            2026,
            0,
            1
        );


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;

}


function defaultHistoryTo(){

    const date =
        new Date();


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;

}


/* =========================================================
   PART 1 COMPLETE
========================================================= */

console.log(
    "✅ SERVER PART 1 LOADED"
);



/* =========================================================
   HR MATKA BACKEND
   COMPLETE REPLACEMENT
   PART 2 OF 5

   HISTORICAL PARSER:
   - PANEL / JODI NORMALIZATION
   - TABLE ROW EXTRACTION
   - WEEK RANGE PARSING
   - DAILY RESULT PARSING
   - SPLIT OPEN/JODI/CLOSE PARSING
   - HISTORICAL RECORD CREATION
   - PRIMARY SOURCE HISTORY PARSER
========================================================= */


/* =========================================================
   PANEL NORMALIZATION
========================================================= */

function normalizePanel(value){

    const raw =
        cleanText(
            value
        );


    if(
        !raw
        ||
        raw.includes("*")
    ){

        return "";
    }


    const digits =
        digitsOnly(
            raw
        );


    if(
        digits.length !== 3
    ){

        return "";
    }


    return digits;

}


/* =========================================================
   JODI NORMALIZATION
========================================================= */

function normalizeJodi(value){

    const raw =
        cleanText(
            value
        );


    if(
        !raw
        ||
        raw.includes("*")
    ){

        return "";
    }


    const digits =
        digitsOnly(
            raw
        );


    if(
        digits.length === 1
    ){

        return digits.padStart(
            2,
            "0"
        );
    }


    if(
        digits.length === 2
    ){

        return digits;
    }


    return "";

}


/* =========================================================
   TABLE ROW EXTRACTOR
========================================================= */

function extractTableRows(html){

    const rows = [];


    const source =
        String(
            html ?? ""
        );


    const rowRegex =
        /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;


    let rowMatch;


    while(
        (
            rowMatch =
            rowRegex.exec(
                source
            )
        )
        !==
        null
    ){

        const rowHtml =
            rowMatch[1];


        const cells = [];


        const cellRegex =
            /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;


        let cellMatch;


        while(
            (
                cellMatch =
                cellRegex.exec(
                    rowHtml
                )
            )
            !==
            null
        ){

            cells.push(
                stripTags(
                    cellMatch[2]
                )
            );
        }


        if(
            cells.length
        ){

            rows.push(
                cells
            );
        }

    }


    return rows;

}


/* =========================================================
   PAGE TITLE
========================================================= */

function getPageTitle(html){

    const match =
        String(
            html ?? ""
        )
        .match(
            /<title\b[^>]*>([\s\S]*?)<\/title>/i
        );


    if(!match){

        return "";
    }


    return stripTags(
        match[1]
    );

}


/* =========================================================
   WEEK RANGE PARSER

   Supports:
   26/02/18 to 04/03/18
   10/08/2026 to 16/08/2026
========================================================= */

function parseWeekRange(value){

    const raw =
        cleanText(
            value
        );


    const matches =
        raw.match(
            /\d{1,2}[\/\-]\d{1,2}[\/\-](?:\d{4}|\d{2})(?!\d)/g
        );


    if(
        !matches
        ||
        !matches.length
    ){

        return null;
    }


    const start =
        parseDate(
            matches[0]
        );


    if(!start){

        return null;
    }


    let end =
        addDays(
            start,
            6
        );


    if(
        matches.length >= 2
    ){

        const parsedEnd =
            parseDate(
                matches[1]
            );


        if(parsedEnd){

            end =
                parsedEnd;
        }

    }


    return {

        start,
        end

    };

}


/* =========================================================
   FIND WEEK CELL
========================================================= */

function findWeekCell(cells){

    if(
        !Array.isArray(
            cells
        )
    ){

        return null;
    }


    for(
        let index = 0;
        index < cells.length;
        index++
    ){

        const week =
            parseWeekRange(
                cells[index]
            );


        if(week){

            return {

                index,
                week

            };
        }

    }


    return null;

}


/* =========================================================
   DAILY RESULT CELL PARSER

   Supported examples:

   178-61-399
   178 61 399
   1 7 8 61 3 9 9
   178
========================================================= */

function parseDailyResultCell(value){

    const raw =
        cleanText(
            value
        );


    if(
        !raw
        ||
        raw === "-"
        ||
        raw === "--"
        ||
        upper(raw).includes(
            "HOLIDAY"
        )
    ){

        return null;
    }


    const withoutStars =
        raw
        .replace(
            /\*/g,
            ""
        )
        .trim();


    if(!withoutStars){

        return null;
    }


    /* =====================================================
       FORMAT:
       178-61-399
       178 61 399
    ===================================================== */

    const compact =
        raw.match(
            /(?:^|\D)(\d{3})\D+(\d{1,2})\D+(\d{3})(?:\D|$)/
        );


    if(compact){

        const openPanel =
            compact[1];


        const jodi =
            compact[2]
            .padStart(
                2,
                "0"
            );


        const closePanel =
            compact[3];


        if(
            validPanel(openPanel)
            &&
            validJodi(jodi)
            &&
            validPanel(closePanel)
        ){

            return {

                openPanel,

                openSingle:
                    calculateSingle(
                        openPanel
                    ),

                jodi,

                closeSingle:
                    calculateSingle(
                        closePanel
                    ),

                closePanel,

                complete:
                    true

            };
        }

    }


    /* =====================================================
       TOKEN BASED FORMAT:
       1 7 8 61 3 9 9
    ===================================================== */

    const tokens =
        raw.match(
            /\d+/g
        )
        ||
        [];


    if(
        tokens.length >= 7
        &&
        /^\d$/.test(tokens[0])
        &&
        /^\d$/.test(tokens[1])
        &&
        /^\d$/.test(tokens[2])
    ){

        const openPanel =
            tokens[0]
            +
            tokens[1]
            +
            tokens[2];


        const jodiToken =
            tokens[3];


        const closeTokens =
            tokens.slice(
                4,
                7
            );


        if(
            /^\d{1,2}$/.test(
                jodiToken
            )
            &&
            closeTokens.length === 3
            &&
            closeTokens.every(
                function(item){

                    return /^\d$/.test(
                        item
                    );
                }
            )
        ){

            const jodi =
                jodiToken.padStart(
                    2,
                    "0"
                );


            const closePanel =
                closeTokens.join(
                    ""
                );


            if(
                validPanel(openPanel)
                &&
                validJodi(jodi)
                &&
                validPanel(closePanel)
            ){

                return {

                    openPanel,

                    openSingle:
                        calculateSingle(
                            openPanel
                        ),

                    jodi,

                    closeSingle:
                        calculateSingle(
                            closePanel
                        ),

                    closePanel,

                    complete:
                        true

                };
            }

        }

    }


    /* =====================================================
       THREE TOKEN FORMAT:
       178 | 61 | 399
    ===================================================== */

    if(
        tokens.length >= 3
        &&
        /^\d{3}$/.test(
            tokens[0]
        )
        &&
        /^\d{1,2}$/.test(
            tokens[1]
        )
        &&
        /^\d{3}$/.test(
            tokens[2]
        )
    ){

        const openPanel =
            tokens[0];


        const jodi =
            tokens[1]
            .padStart(
                2,
                "0"
            );


        const closePanel =
            tokens[2];


        return {

            openPanel,

            openSingle:
                calculateSingle(
                    openPanel
                ),

            jodi,

            closeSingle:
                calculateSingle(
                    closePanel
                ),

            closePanel,

            complete:
                true

        };

    }


    /* =====================================================
       OPEN PANEL ONLY
    ===================================================== */

    const panel =
        normalizePanel(
            raw
        );


    if(
        validPanel(
            panel
        )
    ){

        return {

            openPanel:
                panel,

            openSingle:
                calculateSingle(
                    panel
                ),

            jodi:
                "",

            closeSingle:
                "",

            closePanel:
                "",

            complete:
                false

        };
    }


    return null;

}


/* =========================================================
   SPLIT DAY PARSER

   OPEN PANEL | JODI | CLOSE PANEL
========================================================= */

function parseSplitDay(
    openValue,
    jodiValue,
    closeValue
){

    const openPanel =
        normalizePanel(
            openValue
        );


    if(
        !validPanel(
            openPanel
        )
    ){

        return null;
    }


    const jodi =
        normalizeJodi(
            jodiValue
        );


    const closePanel =
        normalizePanel(
            closeValue
        );


    return {

        openPanel,

        openSingle:
            calculateSingle(
                openPanel
            ),

        jodi,

        closeSingle:
            validPanel(
                closePanel
            )
            ?
            calculateSingle(
                closePanel
            )
            :
            "",

        closePanel,

        complete:
            validPanel(
                closePanel
            )

    };

}


/* =========================================================
   HISTORICAL RECORD CREATOR

   IMPORTANT:
   settlementAllowed = false
========================================================= */

function createHistoricalRecord(
    market,
    date,
    openPanel,
    jodi,
    closePanel,
    source,
    sourceUrl
){

    const normalizedMarket =
        cleanText(
            market
        );


    const open =
        normalizePanel(
            openPanel
        );


    const close =
        normalizePanel(
            closePanel
        );


    let pair =
        normalizeJodi(
            jodi
        );


    if(
        !normalizedMarket
        ||
        !(date instanceof Date)
        ||
        !validPanel(
            open
        )
    ){

        return null;
    }


    const openSingle =
        calculateSingle(
            open
        );


    let closeSingle = "";
    let status = "OPEN";


    let result =
        open
        +
        "-"
        +
        openSingle
        +
        "*-***";


    if(
        validPanel(
            close
        )
    ){

        closeSingle =
            calculateSingle(
                close
            );


        if(
            !validJodi(
                pair
            )
        ){

            pair =
                openSingle
                +
                closeSingle;
        }


        result =
            open
            +
            "-"
            +
            pair
            +
            "-"
            +
            close;


        status =
            "COMPLETE";
    }


    const dateText =
        formatDate(
            date
        );


    const safeMarketId =
        normalizeMarketName(
            normalizedMarket
        )
        .replace(
            /\s+/g,
            "-"
        )
        .toLowerCase();


    return {

        id:
            "history-"
            +
            safeMarketId
            +
            "-"
            +
            dateText
            .replace(
                /\D/g,
                ""
            ),

        market:
            normalizedMarket,

        date:
            dateText,

        openPanel:
            open,

        openSingle,

        jodi:
            pair,

        closeSingle,

        closePanel:
            close,

        result,

        status,

        historical:
            true,

        settlementAllowed:
            false,

        source:
            cleanText(
                source
            ),

        sourceUrl:
            cleanText(
                sourceUrl
            ),

        importedAt:
            new Date()
            .toISOString()

    };

}


/* =========================================================
   PARSE SEVEN DAILY CELLS

   DATE | MON | TUE | WED | THU | FRI | SAT | SUN
========================================================= */

function parseSevenDayCells(
    resultCells,
    week,
    options,
    output
){

    let added = 0;


    const totalDays =
        Math.min(
            7,
            resultCells.length
        );


    for(
        let dayIndex = 0;
        dayIndex < totalDays;
        dayIndex++
    ){

        const date =
            addDays(
                week.start,
                dayIndex
            );


        if(
            !inRange(
                date,
                options.fromDate,
                options.toDate
            )
        ){

            continue;
        }


        const parsed =
            parseDailyResultCell(
                resultCells[
                    dayIndex
                ]
            );


        if(!parsed){

            continue;
        }


        const record =
            createHistoricalRecord(

                options.market,

                date,

                parsed.openPanel,

                parsed.jodi,

                parsed.closePanel,

                options.source,

                options.sourceUrl

            );


        if(record){

            output.push(
                record
            );


            added++;
        }

    }


    return added;

}


/* =========================================================
   PARSE 21-CELL SPLIT FORMAT

   MON = OPEN | JODI | CLOSE
   x 7 DAYS
========================================================= */

function parseTwentyOneDayCells(
    resultCells,
    week,
    options,
    output
){

    let added = 0;


    const availableDays =
        Math.min(
            7,
            Math.floor(
                resultCells.length / 3
            )
        );


    for(
        let dayIndex = 0;
        dayIndex < availableDays;
        dayIndex++
    ){

        const base =
            dayIndex * 3;


        const parsed =
            parseSplitDay(

                resultCells[
                    base
                ],

                resultCells[
                    base + 1
                ],

                resultCells[
                    base + 2
                ]

            );


        if(!parsed){

            continue;
        }


        const date =
            addDays(
                week.start,
                dayIndex
            );


        if(
            !inRange(
                date,
                options.fromDate,
                options.toDate
            )
        ){

            continue;
        }


        const record =
            createHistoricalRecord(

                options.market,

                date,

                parsed.openPanel,

                parsed.jodi,

                parsed.closePanel,

                options.source,

                options.sourceUrl

            );


        if(record){

            output.push(
                record
            );


            added++;
        }

    }


    return added;

}


/* =========================================================
   MAIN HISTORICAL TABLE PARSER

   PRIMARY SOURCE MODE:
   - Finds date range
   - Detects normal 7-cell rows
   - Falls back to 21-cell split rows
========================================================= */

function parseHistoricalTable(
    html,
    options
){

    options =
        options || {};


    const market =
        cleanText(
            options.market
        );


    const source =
        cleanText(
            options.source ||
            "Historical Source"
        );


    const sourceUrl =
        cleanText(
            options.sourceUrl ||
            ""
        );


    const fromDate =
        options.fromDate ||
        defaultHistoryFrom();


    const toDate =
        options.toDate ||
        defaultHistoryTo();


    const rows =
        extractTableRows(
            html
        );


    const output = [];


    for(
        const row of rows
    ){

        if(
            !Array.isArray(row)
            ||
            row.length < 2
        ){

            continue;
        }


        const weekData =
            findWeekCell(
                row
            );


        if(!weekData){

            continue;
        }


        const week =
            weekData.week;


        if(
            startOfDay(
                week.end
            )
            <
            startOfDay(
                fromDate
            )
            ||
            startOfDay(
                week.start
            )
            >
            startOfDay(
                toDate
            )
        ){

            continue;
        }


        const resultCells =
            row.slice(
                weekData.index + 1
            );


        if(
            !resultCells.length
        ){

            continue;
        }


        let added = 0;


        /*
           Most weekly pages:
           7 daily cells.
        */

        if(
            resultCells.length <= 10
        ){

            added =
                parseSevenDayCells(

                    resultCells,

                    week,

                    {
                        market,
                        source,
                        sourceUrl,
                        fromDate,
                        toDate
                    },

                    output

                );
        }


        /*
           Split result format:
           OPEN | JODI | CLOSE
        */

        if(
            added === 0
            &&
            resultCells.length >= 3
        ){

            added =
                parseTwentyOneDayCells(

                    resultCells,

                    week,

                    {
                        market,
                        source,
                        sourceUrl,
                        fromDate,
                        toDate
                    },

                    output

                );
        }


        /*
           Last fallback:
           first 7 cells try.
        */

        if(
            added === 0
            &&
            resultCells.length > 10
        ){

            parseSevenDayCells(

                resultCells.slice(
                    0,
                    7
                ),

                week,

                {
                    market,
                    source,
                    sourceUrl,
                    fromDate,
                    toDate
                },

                output

            );
        }

    }


    return output;

}


/* =========================================================
   HISTORY DEDUPE

   UNIQUE:
   MARKET + DATE

   COMPLETE result wins over OPEN-only.
========================================================= */

function dedupeHistory(records){

    const map =
        new Map();


    (
        Array.isArray(
            records
        )
        ?
        records
        :
        []
    )
    .forEach(
        function(record){

            if(!record){

                return;
            }


            const key =
                normalizeMarketName(
                    record.market
                )
                +
                "|"
                +
                cleanText(
                    record.date
                );


            const previous =
                map.get(
                    key
                );


            if(!previous){

                map.set(
                    key,
                    record
                );

                return;
            }


            const oldComplete =
                validPanel(
                    previous.closePanel
                );


            const newComplete =
                validPanel(
                    record.closePanel
                );


            if(
                !oldComplete
                &&
                newComplete
            ){

                map.set(
                    key,
                    record
                );
            }

        }
    );


    return Array.from(
        map.values()
    );

}


/* =========================================================
   SORT HISTORY OLD -> NEW
========================================================= */

function sortHistory(records){

    records.sort(
        function(a,b){

            const dateA =
                parseDate(
                    a.date
                );


            const dateB =
                parseDate(
                    b.date
                );


            const timeA =
                dateA
                ?
                dateA.getTime()
                :
                0;


            const timeB =
                dateB
                ?
                dateB.getTime()
                :
                0;


            return (
                timeA -
                timeB
            );
        }
    );


    return records;

}


/* =========================================================
   FETCH + PARSE ONE HISTORICAL SOURCE
========================================================= */

async function fetchHistoricalSource(
    options
){

    options =
        options || {};


    const safeUrl =
        validateSourceUrl(
            options.url
        );


    const html =
        await fetchHtml(
            safeUrl
        );


    let records =
        parseHistoricalTable(
            html,
            {

                market:
                    cleanText(
                        options.market
                    ),

                source:
                    cleanText(
                        options.source ||
                        "Historical Source"
                    ),

                sourceUrl:
                    safeUrl,

                fromDate:
                    options.fromDate ||
                    defaultHistoryFrom(),

                toDate:
                    options.toDate ||
                    defaultHistoryTo()

            }
        );


    records =
        dedupeHistory(
            records
        );


    sortHistory(
        records
    );


    return {

        url:
            safeUrl,

        source:
            cleanText(
                options.source ||
                "Historical Source"
            ),

        market:
            cleanText(
                options.market
            ),

        htmlBytes:
            Buffer.byteLength(
                html,
                "utf8"
            ),

        tableRows:
            extractTableRows(
                html
            )
            .length,

        records

    };

}


/* =========================================================
   PART 2 COMPLETE
========================================================= */

console.log(
    "✅ SERVER PART 2 LOADED"
);


/* =========================================================
   HR MATKA BACKEND
   COMPLETE REPLACEMENT
   PART 3 OF 5

   APIS:
   - SAFE HISTORY RANGE
   - SOURCE TEST
   - PRIMARY-ONLY HISTORY IMPORT
   - READ-ONLY LIVE FETCH
   - STRICT OPEN VALIDATION
========================================================= */


/* =========================================================
   QUERY PARAM HELPER
========================================================= */

function getQueryParams(requestUrl){

    return new URL(
        requestUrl,
        "http://" + HOST + ":" + PORT
    ).searchParams;

}


/* =========================================================
   SAFE HISTORY RANGE

   Minimum:
   01/01/2026

   Maximum:
   Today
========================================================= */

function getSafeHistoryRange(
    fromValue,
    toValue
){

    let fromDate =
        parseApiDate(
            fromValue
        )
        ||
        defaultHistoryFrom();


    let toDate =
        parseApiDate(
            toValue
        )
        ||
        defaultHistoryTo();


    const minimum =
        defaultHistoryFrom();


    const today =
        defaultHistoryTo();


    if(
        startOfDay(
            fromDate
        )
        <
        startOfDay(
            minimum
        )
    ){

        fromDate =
            minimum;
    }


    if(
        startOfDay(
            toDate
        )
        >
        startOfDay(
            today
        )
    ){

        toDate =
            today;
    }


    if(
        startOfDay(
            fromDate
        )
        >
        startOfDay(
            toDate
        )
    ){

        throw new Error(
            "Invalid History Date Range"
        );
    }


    return {

        fromDate,
        toDate

    };

}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function handleHealth(
    req,
    res
){

    sendJson(
        res,
        200,
        {

            ok:
                true,

            project:
                "HR MATKA",

            backend:
                "Connected",

            mode:
                "PRIMARY_HISTORY_ONLY",

            historicalImport:
                true,

            liveProxy:
                true,

            strictOpenRule:
                true,

            historicalSettlement:
                false,

            serverTime:
                new Date()
                .toISOString()

        }
    );

}


/* =========================================================
   SOURCE TEST

   GET:
   /api/source/test?url=https://...
========================================================= */

async function handleSourceTest(
    req,
    res
){

    try{

        const params =
            getQueryParams(
                req.url
            );


        const requestedUrl =
            params.get(
                "url"
            );


        const safeUrl =
            validateSourceUrl(
                requestedUrl
            );


        const html =
            await fetchHtml(
                safeUrl
            );


        const rows =
            extractTableRows(
                html
            );


        sendJson(
            res,
            200,
            {

                ok:
                    true,

                status:
                    "Working",

                sourceUrl:
                    safeUrl,

                title:
                    getPageTitle(
                        html
                    ),

                bytes:
                    Buffer.byteLength(
                        html,
                        "utf8"
                    ),

                tableRowCount:
                    rows.length,

                tableRowsSample:
                    rows.slice(
                        0,
                        3
                    )

            }
        );

    }
    catch(error){

        sendJson(
            res,
            500,
            {

                ok:
                    false,

                status:
                    "Error",

                message:
                    String(
                        error.message
                        ||
                        error
                    )

            }
        );

    }

}


/* =========================================================
   PRIMARY-ONLY HISTORICAL IMPORT

   POST:
   /api/history/import

   BODY:
   {
       "market":"SRIDEVI",
       "url":"https://dpbosssss.boston/...",
       "source":"DPBOSS",
       "from":"2026-01-01",
       "to":"2026-08-18"
   }

   IMPORTANT:
   - Historical chart only
   - Wallet/bet settlement disabled
========================================================= */

async function handleHistoryImport(
    req,
    res
){

    try{

        const body =
            await readJsonBody(
                req
            );


        const market =
            cleanText(
                body.market
            );


        if(
            !market
        ){

            throw new Error(
                "Market Required"
            );
        }


        const requestedUrl =
            normalizeSourceUrl(
                body.url
            );


        if(
            !requestedUrl
        ){

            throw new Error(
                "Historical Source URL Required"
            );
        }


        const source =
            cleanText(
                body.source
                ||
                "DPBOSS"
            );


        const range =
            getSafeHistoryRange(
                body.from,
                body.to
            );


        const result =
            await fetchHistoricalSource(
                {

                    url:
                        requestedUrl,

                    source:
                        source,

                    market:
                        market,

                    fromDate:
                        range.fromDate,

                    toDate:
                        range.toDate

                }
            );


        sendJson(
            res,
            200,
            {

                ok:
                    true,

                market:
                    market,

                source:
                    result.source,

                sourceUrl:
                    result.url,

                from:
                    formatDate(
                        range.fromDate
                    ),

                to:
                    formatDate(
                        range.toDate
                    ),

                htmlBytes:
                    result.htmlBytes,

                tableRows:
                    result.tableRows,

                total:
                    result.records.length,

                records:
                    result.records

            }
        );

    }
    catch(error){

        sendJson(
            res,
            500,
            {

                ok:
                    false,

                message:
                    String(
                        error.message
                        ||
                        error
                    ),

                total:
                    0,

                records:
                    []

            }
        );

    }

}


/* =========================================================
   READ-ONLY LIVE FETCH

   POST:
   /api/live/fetch

   BODY:
   {
       "url":"https://..."
   }
========================================================= */

async function handleLiveFetch(
    req,
    res
){

    try{

        const body =
            await readJsonBody(
                req
            );


        const requestedUrl =
            normalizeSourceUrl(
                body.url
            );


        if(
            !requestedUrl
        ){

            throw new Error(
                "Source URL Required"
            );
        }


        const safeUrl =
            validateSourceUrl(
                requestedUrl
            );


        const html =
            await fetchHtml(
                safeUrl
            );


        sendJson(
            res,
            200,
            {

                ok:
                    true,

                sourceUrl:
                    safeUrl,

                title:
                    getPageTitle(
                        html
                    ),

                bytes:
                    Buffer.byteLength(
                        html,
                        "utf8"
                    ),

                html:
                    html

            }
        );

    }
    catch(error){

        sendJson(
            res,
            500,
            {

                ok:
                    false,

                message:
                    String(
                        error.message
                        ||
                        error
                    )

            }
        );

    }

}


/* =========================================================
   STRICT OPEN VALIDATION

   RULE:
   During OPEN phase:
   JODI or CLOSE present => full candidate reject
========================================================= */

function validateStrictOpenResult(candidate){

    candidate =
        candidate || {};


    const openPanel =
        normalizePanel(
            candidate.openPanel
        );


    const sourceOpenSingle =
        cleanText(
            candidate.openSingle
        );


    const sourceJodi =
        normalizeJodi(
            candidate.jodi
        );


    const sourceClosePanel =
        normalizePanel(
            candidate.closePanel
        );


    if(
        !validPanel(
            openPanel
        )
    ){

        return {

            ok:
                false,

            reason:
                "INVALID_OPEN_PANEL"

        };
    }


    if(
        validJodi(
            sourceJodi
        )
        ||
        validPanel(
            sourceClosePanel
        )
    ){

        return {

            ok:
                false,

            reason:
                "FULL_RESULT_DURING_OPEN_REJECTED"

        };
    }


    const calculatedSingle =
        calculateSingle(
            openPanel
        );


    if(
        sourceOpenSingle
        &&
        (
            !validSingle(
                sourceOpenSingle
            )
            ||
            sourceOpenSingle
            !==
            calculatedSingle
        )
    ){

        return {

            ok:
                false,

            reason:
                "OPEN_SINGLE_MISMATCH"

        };
    }


    return {

        ok:
            true,

        phase:
            "OPEN",

        openPanel:
            openPanel,

        openSingle:
            calculatedSingle

    };

}


/* =========================================================
   STRICT OPEN API

   POST:
   /api/live/validate-open
========================================================= */

async function handleValidateOpen(
    req,
    res
){

    try{

        const body =
            await readJsonBody(
                req
            );


        const validation =
            validateStrictOpenResult(
                {

                    openPanel:
                        body.openPanel,

                    openSingle:
                        body.openSingle,

                    jodi:
                        body.jodi,

                    closePanel:
                        body.closePanel

                }
            );


        sendJson(
            res,
            200,
            {

                ok:
                    validation.ok,

                rejected:
                    !validation.ok,

                reason:
                    validation.reason
                    ||
                    "",

                phase:
                    validation.phase
                    ||
                    "",

                openPanel:
                    validation.openPanel
                    ||
                    "",

                openSingle:
                    validation.openSingle
                    ||
                    ""

            }
        );

    }
    catch(error){

        sendJson(
            res,
            500,
            {

                ok:
                    false,

                rejected:
                    true,

                message:
                    String(
                        error.message
                        ||
                        error
                    )

            }
        );

    }

}



/* =========================================================
   HR MATKA 24x7 AUTO RESULT ENGINE
   COMPLETE SERVER-SIDE LIVE CORE

   RULES:
   - Exact 14 markets.
   - Primary source: DPBOSS Boston.
   - Poll every 30 seconds while Node server is running.
   - OPEN phase accepts OPEN-only result.
   - OPEN phase rejects full OPEN+JODI+CLOSE result.
   - CLOSE requires a saved OPEN and matching source OPEN.
   - Jodi is recalculated from OPEN/CLOSE singles.
   - Live state persists to disk so a server restart does not
     erase today's already accepted OPEN/CLOSE result.
========================================================= */

const AUTO_STATE_FILE =
    path.join(
        __dirname,
        "hr-live-result-state.json"
    );

const HR_PRIMARY_LIVE_SOURCE = {
    name: "DPBOSS Boston",
    url: "https://dpbosssss.boston/"
};

const HR_SECONDARY_LIVE_SOURCE = {
    name: "Satta Matka DPBoss",
    url: "https://sattamatkadpboss.mobi/"
};

const HR_AUTO_MARKETS_14 = [
    { market:"SRIDEVI",         openTime:"11:30", closeTime:"12:30" },
    { market:"TIME BAZAR",      openTime:"12:50", closeTime:"13:50" },
    { market:"MADHUR DAY",      openTime:"13:25", closeTime:"14:25" },
    { market:"MILAN DAY",       openTime:"14:50", closeTime:"16:50" },
    { market:"RAJDHANI DAY",    openTime:"15:05", closeTime:"17:05" },
    { market:"SUPREME DAY",     openTime:"15:30", closeTime:"17:30" },
    { market:"KALYAN",          openTime:"15:40", closeTime:"17:40" },
    { market:"SRIDEVI NIGHT",   openTime:"19:10", closeTime:"20:10" },
    { market:"MADHUR NIGHT",    openTime:"20:25", closeTime:"22:25" },
    { market:"SUPREME NIGHT",   openTime:"20:40", closeTime:"22:40" },
    { market:"MILAN NIGHT",     openTime:"20:55", closeTime:"22:55" },
    { market:"KALYAN NIGHT",    openTime:"21:30", closeTime:"23:30" },
    { market:"RAJDHANI NIGHT",  openTime:"21:30", closeTime:"23:45" },
    { market:"MAIN BAZAR",      openTime:"21:45", closeTime:"23:55" }
];

const HR_AUTO_ENGINE = {
    enabled: true,
    intervalMs: 30000,
    running: false,
    timer: null,
    lastCycleAt: "",
    lastError: "",
    markets: new Map(),
    liveResults: new Map()
};

/* =========================================================
   SMART RESULT WATCH WINDOW

   Result normally scheduled time ke 10-20 min baad aata hai.
   Isliye network fetch sirf result-waiting window me hoga.

   Start: scheduled OPEN/CLOSE time + 5 minutes
   End:   scheduled OPEN/CLOSE time + 35 minutes
   Poll:  every 30 seconds (scheduler already 30000 ms)

   Window ke bahar server source website ko hit nahi karega.
========================================================= */

const HR_RESULT_WATCH = {
    startDelayMinutes: 5,
    endDelayMinutes: 35
};

function autoMarketKey(value){
    return normalizeMarketName(value);
}

function autoNormalizeTime(value){
    const raw = cleanText(value);
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if(!match){ return ""; }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if(hour < 0 || hour > 23 || minute < 0 || minute > 59){
        return "";
    }
    return String(hour).padStart(2,"0") + ":" + String(minute).padStart(2,"0");
}

function autoTimeMinutes(value){
    const normalized = autoNormalizeTime(value);
    if(!normalized){ return null; }
    const parts = normalized.split(":").map(Number);
    return (parts[0] * 60) + parts[1];
}

function autoToday(){
    return formatDate(new Date());
}

function autoResultKey(market,dateText){
    return autoMarketKey(market) + "|" + cleanText(dateText);
}

function autoGetResult(market,dateText){
    const finalDate = cleanText(dateText) || autoToday();
    return HR_AUTO_ENGINE.liveResults.get(
        autoResultKey(market,finalDate)
    ) || null;
}

function persistAutoState(){
    try{
        const payload = {
            savedAt: new Date().toISOString(),
            records: Array.from(HR_AUTO_ENGINE.liveResults.values())
        };
        fs.writeFileSync(
            AUTO_STATE_FILE,
            JSON.stringify(payload,null,2),
            "utf8"
        );
    }
    catch(error){
        console.error("❌ AUTO STATE SAVE ERROR:",error.message || error);
    }
}

function restoreAutoState(){
    try{
        if(!fs.existsSync(AUTO_STATE_FILE)){
            return;
        }
        const raw = fs.readFileSync(AUTO_STATE_FILE,"utf8");
        const data = JSON.parse(raw);
        const records = Array.isArray(data.records) ? data.records : [];
        records.forEach(function(record){
            if(record && record.market && record.date){
                HR_AUTO_ENGINE.liveResults.set(
                    autoResultKey(record.market,record.date),
                    record
                );
            }
        });
        console.log("✅ AUTO STATE RESTORED:",records.length);
    }
    catch(error){
        console.error("❌ AUTO STATE RESTORE ERROR:",error.message || error);
    }
}

function autoSaveResult(record){
    if(!record || !record.market || !record.date){
        return null;
    }
    HR_AUTO_ENGINE.liveResults.set(
        autoResultKey(record.market,record.date),
        record
    );
    persistAutoState();
    return record;
}

function autoGetMarketPhase(config){
    if(!config){ return "INVALID"; }
    if(config.holiday === true){ return "HOLIDAY"; }

    const openMinutes = autoTimeMinutes(config.openTime);
    const closeMinutes = autoTimeMinutes(config.closeTime);
    if(openMinutes === null || closeMinutes === null){
        return "INVALID_TIME";
    }

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();

    if(currentMinutes < openMinutes){ return "RUNNING"; }
    if(currentMinutes < closeMinutes){ return "OPEN"; }
    return "CLOSE";
}

function autoEscapeRegex(value){
    return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function autoParseResultBlock(value){
    const raw = cleanText(value);
    if(!raw){ return null; }

    // COMPLETE: XXX-XX-XXX or whitespace-separated equivalent.
    let match = raw.match(
        /(?:^|\D)(\d{3})\s*(?:-|–|\s)\s*(\d{1,2})\s*(?:-|–|\s)\s*(\d{3})(?:\D|$)/
    );

    if(match){
        const openPanel = match[1];
        const closePanel = match[3];
        return {
            openPanel: openPanel,
            openSingle: calculateSingle(openPanel),
            jodi: String(match[2]).padStart(2,"0"),
            closeSingle: calculateSingle(closePanel),
            closePanel: closePanel,
            detectedFormat: "COMPLETE"
        };
    }

    // MASKED OPEN: XXX-X*-***
    match = raw.match(
        /(?:^|\D)(\d{3})\s*[-–]\s*(\d)\s*\*?\s*[-–]\s*\*{3}(?:\D|$)/
    );

    if(match){
        return {
            openPanel: match[1],
            openSingle: match[2],
            jodi: "",
            closeSingle: "",
            closePanel: "",
            detectedFormat: "OPEN_MASKED"
        };
    }

    // SHORT OPEN: XXX-X
    match = raw.match(
        /(?:^|\D)(\d{3})\s*[-–]\s*(\d)(?=\D|$)/
    );

    if(match){
        return {
            openPanel: match[1],
            openSingle: match[2],
            jodi: "",
            closeSingle: "",
            closePanel: "",
            detectedFormat: "OPEN_SHORT"
        };
    }

    return null;
}

function autoFindBestMarketResult(plainText,market){
    const page = cleanText(plainText);
    const wanted = autoMarketKey(market);
    if(!page || !wanted){ return null; }

    const words = wanted.split(/\s+/).filter(Boolean);
    if(!words.length){ return null; }

    const marketPattern = words.map(autoEscapeRegex).join("\\s+");
    const regex = new RegExp(marketPattern,"gi");
    let match;
    let best = null;

    while((match = regex.exec(page)) !== null){
        const afterStart = match.index + match[0].length;
        const afterBlock = page.slice(
            afterStart,
            Math.min(page.length,afterStart + 240)
        );
        const candidate = autoParseResultBlock(afterBlock);

        if(candidate){
            const resultPattern = candidate.detectedFormat === "COMPLETE"
                ? new RegExp(
                    autoEscapeRegex(candidate.openPanel) +
                    "\\s*[-– ]\\s*" +
                    autoEscapeRegex(candidate.jodi)
                  )
                : new RegExp(
                    autoEscapeRegex(candidate.openPanel) +
                    "\\s*[-– ]"
                  );

            const resultMatch = resultPattern.exec(afterBlock);
            const distance = resultMatch ? resultMatch.index : 9999;

            if(distance <= 100){
                if(!best || distance < best.distance){
                    best = {
                        candidate: candidate,
                        distance: distance,
                        sample: afterBlock.slice(0,160)
                    };
                }
            }
        }

        if(regex.lastIndex === match.index){
            regex.lastIndex++;
        }
    }

    return best;
}

function autoParseLiveText(value,market){
    const result = autoFindBestMarketResult(value,market);
    if(!result){ return null; }

    console.log(
        "✅ PARSER MATCH:",
        market,
        result.candidate.detectedFormat,
        "distance:",
        result.distance
    );

    return result.candidate;
}

function autoParseLiveHtml(html,market){
    if(!html || !market){ return null; }

    const rows = extractTableRows(html);

    for(const row of rows){
        const rowText = cleanText(row.join(" "));
        if(autoMarketKey(rowText).includes(autoMarketKey(market))){
            const candidate = autoParseLiveText(rowText,market);
            if(candidate){
                return candidate;
            }
        }
    }

    return autoParseLiveText(stripTags(html),market);
}

function autoCreateOpenRecord(config,validation){
    const openPanel = validation.openPanel;
    const openSingle = calculateSingle(openPanel);

    return {
        id:
            "live-" +
            autoMarketKey(config.market).replace(/\s+/g,"-").toLowerCase() +
            "-" +
            autoToday().replace(/\D/g,""),
        market: cleanText(config.market),
        date: autoToday(),
        openPanel: openPanel,
        openSingle: openSingle,
        jodi: "",
        closeSingle: "",
        closePanel: "",
        result: openPanel + "-" + openSingle + "*-***",
        status: "OPEN",
        historical: false,
        settlementAllowed: true,
        source: cleanText(config.source || "LIVE SOURCE"),
        sourceUrl: cleanText(config.url),
        updatedAt: new Date().toISOString()
    };
}

function autoValidateClose(candidate,savedOpen){
    if(!savedOpen || !validPanel(savedOpen.openPanel)){
        return { ok:false, reason:"OPEN_NOT_SAVED" };
    }

    const sourceOpenPanel = normalizePanel(candidate.openPanel);
    const closePanel = normalizePanel(candidate.closePanel);

    if(!validPanel(closePanel)){
        return { ok:false, reason:"INVALID_CLOSE_PANEL" };
    }

    if(sourceOpenPanel && sourceOpenPanel !== savedOpen.openPanel){
        return { ok:false, reason:"SOURCE_OPEN_MISMATCH" };
    }

    const openSingle = calculateSingle(savedOpen.openPanel);
    const closeSingle = calculateSingle(closePanel);
    const expectedJodi = openSingle + closeSingle;
    const sourceJodi = normalizeJodi(candidate.jodi);

    if(sourceJodi && sourceJodi !== expectedJodi){
        return { ok:false, reason:"SOURCE_JODI_MISMATCH" };
    }

    return {
        ok: true,
        closePanel: closePanel,
        closeSingle: closeSingle,
        jodi: expectedJodi
    };
}

function autoCreateCloseRecord(config,savedOpen,validation){
    return {
        ...savedOpen,
        jodi: validation.jodi,
        closeSingle: validation.closeSingle,
        closePanel: validation.closePanel,
        result:
            savedOpen.openPanel +
            "-" +
            validation.jodi +
            "-" +
            validation.closePanel,
        status: "COMPLETE",
        historical: false,
        settlementAllowed: true,
        source: cleanText(config.source || savedOpen.source || "LIVE SOURCE"),
        sourceUrl: cleanText(config.url || savedOpen.sourceUrl),
        updatedAt: new Date().toISOString()
    };
}

async function autoPollOneMarket(config){
    const phase = autoGetMarketPhase(config);

    if(phase === "HOLIDAY"){
        return { market:config.market, phase:phase, status:"HOLIDAY" };
    }

    if(phase === "RUNNING"){
        return { market:config.market, phase:phase, status:"WAITING_FOR_OPEN_TIME" };
    }

    if(phase === "INVALID_TIME" || phase === "INVALID"){
        return { market:config.market, phase:phase, status:"SKIPPED" };
    }

    const safeUrl = validateSourceUrl(config.url);
    const html = await fetchHtml(safeUrl);
    const candidate = autoParseLiveHtml(html,config.market);

    if(!candidate){
        return { market:config.market, phase:phase, status:"NO_RESULT" };
    }

    const saved = autoGetResult(config.market);

    if(phase === "OPEN"){
        if(saved && validPanel(saved.openPanel)){
            return {
                market:config.market,
                phase:phase,
                status:"OPEN_ALREADY_SAVED",
                record:saved
            };
        }

        const validation = validateStrictOpenResult(candidate);
        if(!validation.ok){
            return {
                market:config.market,
                phase:phase,
                status:"REJECTED",
                reason:validation.reason
            };
        }

        const record = autoSaveResult(
            autoCreateOpenRecord(config,validation)
        );

        console.log("✅ 24x7 AUTO OPEN:",record.market,record.result);

        return {
            market:config.market,
            phase:phase,
            status:"OPEN_SAVED",
            record:record
        };
    }

    if(saved && saved.status === "COMPLETE"){
        return {
            market:config.market,
            phase:phase,
            status:"COMPLETE_ALREADY_SAVED",
            record:saved
        };
    }

    const closeValidation = autoValidateClose(candidate,saved);

    if(!closeValidation.ok){
        return {
            market:config.market,
            phase:phase,
            status:"REJECTED",
            reason:closeValidation.reason
        };
    }

    const completeRecord = autoSaveResult(
        autoCreateCloseRecord(config,saved,closeValidation)
    );

    console.log("✅ 24x7 AUTO CLOSE:",completeRecord.market,completeRecord.result);

    return {
        market:config.market,
        phase:phase,
        status:"CLOSE_SAVED",
        record:completeRecord
    };
}


/* =========================================================
   SMART RESULT WINDOW HELPERS
========================================================= */

function autoCurrentMinutes(){
    const now = new Date();
    return (now.getHours() * 60) + now.getMinutes();
}

/* =========================================================
   MIDNIGHT-SAFE RESULT WINDOW

   Example MAIN BAZAR CLOSE = 23:55
   Watch window = 00:00 -> 00:30 next calendar day.
   In that period the result still belongs to the previous
   trading date, so both time and saved OPEN lookup must use
   the previous trading date.
========================================================= */

function autoPreviousDateText(){
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDate(date);
}

function autoWindowInfo(
    currentMinutes,
    scheduledMinutes,
    startDelay,
    endDelay
){
    if(
        currentMinutes === null
        ||
        scheduledMinutes === null
    ){
        return { inside:false, crossedMidnight:false };
    }

    const start =
        scheduledMinutes
        +
        Number(startDelay || 0);

    const end =
        scheduledMinutes
        +
        Number(endDelay || 0);

    let adjustedCurrent = currentMinutes;
    const crossesMidnight = end >= (24 * 60);

    if(
        crossesMidnight
        &&
        currentMinutes <= (end - (24 * 60))
    ){
        adjustedCurrent += (24 * 60);
    }

    return {
        inside:
            adjustedCurrent >= start
            &&
            adjustedCurrent <= end,
        crossedMidnight:
            crossesMidnight
            &&
            adjustedCurrent >= (24 * 60)
    };
}

function autoMinutesInsideWindow(
    currentMinutes,
    scheduledMinutes,
    startDelay,
    endDelay
){
    return autoWindowInfo(
        currentMinutes,
        scheduledMinutes,
        startDelay,
        endDelay
    ).inside;
}

function autoGetSmartWatch(config){

    if(!config){
        return null;
    }

    if(config.holiday === true){
        return null;
    }

    const openMinutes = autoTimeMinutes(config.openTime);
    const closeMinutes = autoTimeMinutes(config.closeTime);

    if(openMinutes === null || closeMinutes === null){
        return null;
    }

    const currentMinutes = autoCurrentMinutes();

    const openWindow = autoWindowInfo(
        currentMinutes,
        openMinutes,
        HR_RESULT_WATCH.startDelayMinutes,
        HR_RESULT_WATCH.endDelayMinutes
    );

    const closeWindow = autoWindowInfo(
        currentMinutes,
        closeMinutes,
        HR_RESULT_WATCH.startDelayMinutes,
        HR_RESULT_WATCH.endDelayMinutes
    );

    /* CLOSE window midnight cross kare to saved OPEN
       previous trading date se read hoga. */
    const tradingDate =
        closeWindow.crossedMidnight
        ? autoPreviousDateText()
        : autoToday();

    const saved = autoGetResult(
        config.market,
        tradingDate
    );

    const openAlreadySaved = !!(
        saved
        &&
        validPanel(saved.openPanel)
    );

    if(
        !openAlreadySaved
        &&
        openWindow.inside
    ){
        return {
            phase: "OPEN",
            market: config.market,
            scheduledTime: config.openTime,
            tradingDate: autoToday()
        };
    }

    const completeAlreadySaved = !!(
        saved
        &&
        saved.status === "COMPLETE"
    );

    const hasSavedOpen = !!(
        saved
        &&
        validPanel(saved.openPanel)
    );

    if(
        hasSavedOpen
        &&
        !completeAlreadySaved
        &&
        closeWindow.inside
    ){
        return {
            phase: "CLOSE",
            market: config.market,
            scheduledTime: config.closeTime,
            tradingDate: tradingDate
        };
    }

    return null;
}

async function run24x7AutoResultCycle(){

    if(
        !HR_AUTO_ENGINE.enabled
        ||
        HR_AUTO_ENGINE.running
    ){
        return;
    }

    HR_AUTO_ENGINE.running = true;
    HR_AUTO_ENGINE.lastCycleAt =
        new Date().toISOString();
    HR_AUTO_ENGINE.lastError = "";

    try{

        const markets =
            Array.from(
                HR_AUTO_ENGINE.markets.values()
            );

        if(!markets.length){
            return;
        }

        /* =============================================
           ONLY MARKETS WAITING FOR RESULT

           Scheduler har 30 sec function ko call karega,
           lekin source website tabhi fetch hogi jab kam se
           kam ek market OPEN/CLOSE result-window me ho.
        ============================================= */

        const waitingMarkets = [];

        for(const config of markets){

            const watch =
                autoGetSmartWatch(
                    config
                );

            if(!watch){
                continue;
            }

            waitingMarkets.push({
                config,
                watch
            });
        }

        if(!waitingMarkets.length){

            console.log(
                "😴 AUTO SMART IDLE: NO RESULT WINDOW"
            );

            return;
        }

        console.log(
            "⏳ AUTO WAITING MARKETS:",
            waitingMarkets
                .map(
                    function(item){
                        return (
                            item.config.market
                            +
                            ":"
                            +
                            item.watch.phase
                        );
                    }
                )
                .join(", ")
        );

        /* =============================================
           PRIMARY -> SECONDARY FALLBACK
           ONLY ONE SUCCESSFUL HTML FETCH PER CYCLE
        ============================================= */

        const sources = [
            HR_PRIMARY_LIVE_SOURCE,
            HR_SECONDARY_LIVE_SOURCE
        ];

        let html = "";
        let activeSource = null;
        let lastFetchError = null;

        for(const source of sources){

            try{

                const safeUrl =
                    validateSourceUrl(
                        source.url
                    );

                console.log(
                    "🌐 AUTO SOURCE FETCH:",
                    source.name,
                    safeUrl
                );

                html =
                    await fetchHtml(
                        safeUrl
                    );

                if(!html){
                    throw new Error(
                        "Empty source HTML"
                    );
                }

                activeSource = {
                    name: source.name,
                    url: safeUrl
                };

                console.log(
                    "✅ AUTO SOURCE CONNECTED:",
                    activeSource.name
                );

                break;

            }
            catch(error){

                lastFetchError = error;

                console.warn(
                    "⚠ AUTO SOURCE FAILED:",
                    source.name,
                    error.message || error
                );
            }
        }

        if(
            !activeSource
            ||
            !html
        ){

            throw new Error(
                "ALL_LIVE_SOURCES_FAILED: "
                +
                String(
                    lastFetchError
                    ?
                    (
                        lastFetchError.message
                        ||
                        lastFetchError
                    )
                    :
                    "Unknown source error"
                )
            );
        }

        /* =============================================
           SAME HTML -> ONLY WAITING MARKETS
        ============================================= */

        for(const item of waitingMarkets){

            const originalConfig =
                item.config;

            const watch =
                item.watch;

            try{

                const config = {
                    ...originalConfig,
                    source: activeSource.name,
                    url: activeSource.url
                };

                const candidate =
                    autoParseLiveHtml(
                        html,
                        config.market
                    );

                if(!candidate){

                    console.log(
                        "🔎 AUTO CHECK:",
                        config.market,
                        watch.phase,
                        "NO_RESULT",
                        "SOURCE:",
                        activeSource.name
                    );

                    continue;
                }

                const saved =
                    autoGetResult(
                        config.market,
                        watch.tradingDate
                    );

                /* =================================
                   OPEN RESULT
                ================================= */

                if(
                    watch.phase === "OPEN"
                ){

                    if(
                        saved
                        &&
                        validPanel(
                            saved.openPanel
                        )
                    ){

                        console.log(
                            "🔎 AUTO CHECK:",
                            config.market,
                            "OPEN_ALREADY_SAVED"
                        );

                        continue;
                    }

                    const validation =
                        validateStrictOpenResult(
                            candidate
                        );

                    if(!validation.ok){

                        console.log(
                            "🔎 AUTO CHECK:",
                            config.market,
                            "OPEN_REJECTED",
                            validation.reason || ""
                        );

                        continue;
                    }

                    const record =
                        autoSaveResult(
                            autoCreateOpenRecord(
                                config,
                                validation
                            )
                        );

                    console.log(
                        "✅ 24x7 AUTO OPEN:",
                        record.market,
                        record.result,
                        "SOURCE:",
                        activeSource.name
                    );

                    continue;
                }

                /* =================================
                   CLOSE RESULT
                ================================= */

                if(
                    watch.phase === "CLOSE"
                ){

                    if(
                        saved
                        &&
                        saved.status === "COMPLETE"
                    ){

                        console.log(
                            "🔎 AUTO CHECK:",
                            config.market,
                            "COMPLETE_ALREADY_SAVED"
                        );

                        continue;
                    }

                    const closeValidation =
                        autoValidateClose(
                            candidate,
                            saved
                        );

                    if(!closeValidation.ok){

                        console.log(
                            "🔎 AUTO CHECK:",
                            config.market,
                            "CLOSE_REJECTED",
                            closeValidation.reason || ""
                        );

                        continue;
                    }

                    const completeRecord =
                        autoSaveResult(
                            autoCreateCloseRecord(
                                config,
                                saved,
                                closeValidation
                            )
                        );

                    console.log(
                        "✅ 24x7 AUTO CLOSE:",
                        completeRecord.market,
                        completeRecord.result,
                        "SOURCE:",
                        activeSource.name
                    );

                    continue;
                }

            }
            catch(error){

                console.error(
                    "❌ AUTO MARKET ERROR:",
                    originalConfig.market,
                    error.message || error
                );
            }
        }

    }
    catch(error){

        HR_AUTO_ENGINE.lastError =
            String(
                error.message || error
            );

        console.error(
            "❌ AUTO CYCLE ERROR:",
            HR_AUTO_ENGINE.lastError
        );

    }
    finally{

        HR_AUTO_ENGINE.running = false;

    }

}


function loadDefaultAutoMarkets(){
    HR_AUTO_ENGINE.markets.clear();

    HR_AUTO_MARKETS_14.forEach(function(item){
        HR_AUTO_ENGINE.markets.set(
            autoMarketKey(item.market),
            {
                market: item.market,
                url: HR_PRIMARY_LIVE_SOURCE.url,
                source: HR_PRIMARY_LIVE_SOURCE.name,
                openTime: autoNormalizeTime(item.openTime),
                closeTime: autoNormalizeTime(item.closeTime),
                holiday: false
            }
        );
    });

    console.log("✅ EXACT 14 AUTO MARKETS LOADED:",HR_AUTO_ENGINE.markets.size);
    console.log("✅ PRIMARY AUTO SOURCE:",HR_PRIMARY_LIVE_SOURCE.name);
    console.log("✅ PRIMARY AUTO URL:",HR_PRIMARY_LIVE_SOURCE.url);
}

async function handleAutoConfig(req,res){
    try{
        const body = await readJsonBody(req);
        const list = Array.isArray(body.markets) ? body.markets : [body];
        const savedMarkets = [];

        for(const item of list){
            const market = cleanText(item.market);
            if(!market){ continue; }

            const url = validateSourceUrl(item.url);
            const openTime = autoNormalizeTime(item.openTime);
            const closeTime = autoNormalizeTime(item.closeTime);

            if(!openTime || !closeTime){
                throw new Error("Invalid Open/Close Time: " + market);
            }

            const config = {
                market: market,
                url: url,
                source: cleanText(item.source || "LIVE SOURCE"),
                openTime: openTime,
                closeTime: closeTime,
                holiday: item.holiday === true
            };

            HR_AUTO_ENGINE.markets.set(autoMarketKey(market),config);
            savedMarkets.push(config);
        }

        sendJson(res,200,{
            ok:true,
            total:savedMarkets.length,
            markets:savedMarkets
        });
    }
    catch(error){
        sendJson(res,500,{
            ok:false,
            message:String(error.message || error)
        });
    }
}

async function handleAutoStatus(req,res){
    const markets = Array.from(HR_AUTO_ENGINE.markets.values()).map(
        function(config){
            return {
                market: config.market,
                source: config.source,
                url: config.url,
                openTime: config.openTime,
                closeTime: config.closeTime,
                holiday: config.holiday,
                phase: autoGetMarketPhase(config),
                live: autoGetResult(config.market)
            };
        }
    );

    sendJson(res,200,{
        ok:true,
        enabled:HR_AUTO_ENGINE.enabled,
        running:HR_AUTO_ENGINE.running,
        intervalMs:HR_AUTO_ENGINE.intervalMs,
        lastCycleAt:HR_AUTO_ENGINE.lastCycleAt,
        lastError:HR_AUTO_ENGINE.lastError,
        totalMarkets:markets.length,
        markets:markets
    });
}

async function handleAutoLiveResults(req,res,parsedUrl){
    const market = cleanText(parsedUrl.searchParams.get("market"));
    let records = Array.from(HR_AUTO_ENGINE.liveResults.values());

    if(market){
        records = records.filter(function(item){
            return autoMarketKey(item.market) === autoMarketKey(market);
        });
    }

    records.sort(function(a,b){
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

    sendJson(res,200,{
        ok:true,
        total:records.length,
        records:records
    });
}

restoreAutoState();
loadDefaultAutoMarkets();

console.log("✅ HR MATKA 24x7 AUTO ENGINE CORE READY");
console.log("✅ HR MATKA LIVE PARSER FIX READY");


/* =========================================================
   PART 3 COMPLETE
========================================================= */

console.log(
    "✅ SERVER PART 3 LOADED"
);



/* =========================================================
   HR MATKA BACKEND
   COMPLETE REPLACEMENT
   PART 4 OF 5

   ROUTER + CORS
========================================================= */


/* =========================================================
   CORS OPTIONS
========================================================= */

function handleOptions(
    req,
    res
){

    res.writeHead(
        204,
        {

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type",

            "Access-Control-Max-Age":
                "86400"

        }
    );


    res.end();

}


/* =========================================================
   MAIN SERVER ROUTER
========================================================= */

const server =
    http.createServer(
        async function(
            req,
            res
        ){

            try{

                /* =========================================
                   CORS PRE-FLIGHT
                ========================================= */

                if(
                    req.method ===
                    "OPTIONS"
                ){

                    handleOptions(
                        req,
                        res
                    );


                    return;
                }


                const parsedUrl =
                    new URL(
                        req.url,
                        "http://" + HOST + ":" + PORT
                    );


                const pathname =
                    parsedUrl.pathname;


                /* =========================================
                   HOME
                ========================================= */

                if(
                    req.method ===
                    "GET"
                    &&
                    pathname ===
                    "/"
                ){

                    sendJson(
                        res,
                        200,
                        {

                            ok:
                                true,

                            project:
                                "HR MATKA",

                            message:
                                "Backend Running",

                            mode:
                                "PRIMARY_HISTORY_ONLY",

                            endpoints:{

                                health:
                                    "/api/health",

                                sourceTest:
                                    "/api/source/test",

                                historyImport:
                                    "/api/history/import",

                                liveFetch:
                                    "/api/live/fetch",

                                validateOpen:
                                    "/api/live/validate-open",

                                autoStatus:
                                    "/api/auto/status",

                                liveResults:
                                    "/api/live/results",

                                autoRun:
                                    "/api/auto/run"

                            }

                        }
                    );


                    return;
                }


                /* =========================================
                   HEALTH
                ========================================= */

                if(
                    req.method ===
                    "GET"
                    &&
                    pathname ===
                    "/api/health"
                ){

                    await handleHealth(
                        req,
                        res
                    );


                    return;
                }


                /* =========================================
                   SOURCE TEST
                ========================================= */

                if(
                    req.method ===
                    "GET"
                    &&
                    pathname ===
                    "/api/source/test"
                ){

                    await handleSourceTest(
                        req,
                        res
                    );


                    return;
                }


                /* =========================================
                   PRIMARY HISTORICAL IMPORT
                ========================================= */

                if(
                    req.method ===
                    "POST"
                    &&
                    pathname ===
                    "/api/history/import"
                ){

                    await handleHistoryImport(
                        req,
                        res
                    );


                    return;
                }


                /* =========================================
                   READ-ONLY LIVE FETCH
                ========================================= */

                if(
                    req.method ===
                    "POST"
                    &&
                    pathname ===
                    "/api/live/fetch"
                ){

                    await handleLiveFetch(
                        req,
                        res
                    );


                    return;
                }


                /* =========================================
                   STRICT OPEN VALIDATION
                ========================================= */

                if(
                    req.method ===
                    "POST"
                    &&
                    pathname ===
                    "/api/live/validate-open"
                ){

                    await handleValidateOpen(
                        req,
                        res
                    );


                    return;
                }



                /* =========================================
                   24x7 AUTO CONFIG
                ========================================= */

                if(
                    req.method === "POST"
                    &&
                    pathname === "/api/auto/config"
                ){
                    await handleAutoConfig(req,res);
                    return;
                }


                /* =========================================
                   24x7 AUTO STATUS
                ========================================= */

                if(
                    req.method === "GET"
                    &&
                    pathname === "/api/auto/status"
                ){
                    await handleAutoStatus(req,res);
                    return;
                }


                /* =========================================
                   SERVER LIVE RESULTS
                ========================================= */

                if(
                    req.method === "GET"
                    &&
                    pathname === "/api/live/results"
                ){
                    await handleAutoLiveResults(req,res,parsedUrl);
                    return;
                }


                /* =========================================
                   MANUAL AUTO CYCLE
                ========================================= */

                if(
                    req.method === "POST"
                    &&
                    pathname === "/api/auto/run"
                ){
                    await run24x7AutoResultCycle();
                    await handleAutoStatus(req,res);
                    return;
                }


                /* =========================================
                   NOT FOUND
                ========================================= */

                sendJson(
                    res,
                    404,
                    {

                        ok:
                            false,

                        message:
                            "API Route Not Found",

                        pathname:
                            pathname

                    }
                );

            }
            catch(error){

                console.error(
                    "❌ Router Error:",
                    error
                );


                if(
                    !res.headersSent
                ){

                    sendJson(
                        res,
                        500,
                        {

                            ok:
                                false,

                            message:
                                String(
                                    error.message
                                    ||
                                    error
                                )

                        }
                    );

                }
                else{

                    try{

                        res.end();

                    }
                    catch(endError){

                        console.error(
                            "Response End Error:",
                            endError
                        );

                    }

                }

            }

        }
    );


/* =========================================================
   PART 4 COMPLETE
========================================================= */

console.log(
    "✅ SERVER PART 4 LOADED"
);



/* =========================================================
   HR MATKA BACKEND
   COMPLETE REPLACEMENT
   PART 5 OF 5

   SERVER START
   ERROR HANDLING
   FINAL READY STATUS
========================================================= */


/* =========================================================
   SERVER START
========================================================= */


/* =========================================================
   24x7 AUTO RESULT SCHEDULER
========================================================= */

if(HR_AUTO_ENGINE.timer){
    clearInterval(HR_AUTO_ENGINE.timer);
}

HR_AUTO_ENGINE.timer = setInterval(
    function(){
        run24x7AutoResultCycle();
    },
    HR_AUTO_ENGINE.intervalMs
);

setTimeout(
    function(){
        run24x7AutoResultCycle();
    },
    1500
);

console.log("✅ HR MATKA 24x7 AUTO RESULT SCHEDULER READY");
console.log("✅ Auto Check Every 30 Seconds");

server.listen(
    PORT,
    HOST,
    function(){

        console.log("");
        console.log(
            "============================================"
        );

        console.log(
            "✅ HR MATKA BACKEND RUNNING"
        );

        console.log(
            "✅ Address: http://" +
            HOST +
            ":" +
            PORT
        );

        console.log(
            "✅ Primary-Only Historical Import Ready"
        );

        console.log(
            "✅ Historical Range: January 2026 -> Today"
        );

        console.log(
            "✅ Weekly Historical Chart Parser Ready"
        );

        console.log(
            "✅ Live Source Read Proxy Ready"
        );

        console.log(
            "✅ Strict OPEN Protection Ready"
        );

        console.log(
            "✅ 24x7 Auto Result Engine Ready"
        );

        console.log(
            "✅ Exact 14 Market Live Polling Ready"
        );

        console.log(
            "✅ Persistent Live Result State Ready"
        );

        console.log(
            "✅ Historical Settlement Disabled"
        );

        console.log(
            "============================================"
        );

        console.log("");

    }
);


/* =========================================================
   SERVER ERROR
========================================================= */

server.on(
    "error",
    function(error){

        if(
            error
            &&
            error.code ===
            "EADDRINUSE"
        ){

            console.error(
                "❌ Port " +
                PORT +
                " already in use."
            );

            console.error(
                "❌ Purana Node server pehle stop karein."
            );

            return;
        }


        console.error(
            "❌ HR MATKA Backend Error:",
            error &&
            (
                error.message ||
                error
            )
        );

    }
);


/* =========================================================
   UNHANDLED PROMISE ERROR
========================================================= */

process.on(
    "unhandledRejection",
    function(error){

        console.error(
            "❌ Unhandled Promise Rejection:",
            error
        );

    }
);


/* =========================================================
   UNCAUGHT ERROR LOGGING
========================================================= */

process.on(
    "uncaughtException",
    function(error){

        console.error(
            "❌ Uncaught Exception:",
            error &&
            (
                error.stack ||
                error.message ||
                error
            )
        );

    }
);


/* =========================================================
   FINAL SERVER STATUS
========================================================= */

console.log(
    "✅ SERVER PART 5 LOADED"
);


/* =========================================================
   SERVER.JS COMPLETE

   PART 1
   +
   PART 2
   +
   PART 3
   +
   PART 4
   +
   PART 5

   = COMPLETE SERVER.JS
========================================================= */
