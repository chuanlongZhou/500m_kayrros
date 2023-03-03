
function csvToJson(csvString) {
    const lines = csvString.split('\n');
    const headers = lines[0].split(',');
    //    console.log(headers)
    const result = [];
    const date_keys = []
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');

        for (let j = 0; j < headers.length; j++) {
            if ((headers[j].endsWith("norm")) | (headers[j] == "index")) {

                obj[headers[j]] = currentLine[j];
            }
            else {
                date_keys.push(headers[j])
            }
        }

        result.push(obj);
    }
    result.pop()
    // console.log( result)
    return { result, date_keys };
}

function getColor(d, grade_list) {
    return  d > grade_list[7]/100 ? '#800026' :
            d > grade_list[6]/100 ? '#BD0026' :
            d > grade_list[5]/100 ? '#E31A1C' :
            d > grade_list[4]/100 ? '#FC4E2A' :
            d > grade_list[3]/100 ? '#FD8D3C' :
            d > grade_list[2]/100 ? '#FEB24C' :
            d > grade_list[1]/100 ? '#FED976' :
                            '#dddddd';
}

function get_day_value(csv_json, key) {
    return csv_json.map(obj => {
        var res = {}
        res[key] = obj[key + "_norm"]
        res["index"] = parseInt(obj.index)
        return res
    });
}

async function get_data(r, year, date, scope) {
    const base_url = 'https://raw.githubusercontent.com/chuanlongZhou/500m_BIGCarbon/main/'
    console.log(year, date, scope)

    var geoJson_url = base_url + `/${r}/${r}.geojson`
    var csv_fils = base_url + `${r}/${r}_${year}_BCII${scope}.csv`

    var geoJson_data, csv_data, day_value, date_keys
    geoJson_data = await fetch(geoJson_url).then(res => res.json()).then(data => data);
    csv_data = await fetch(csv_fils).then(response => response.text())
    // console.log( csv_data)

    res = csvToJson(csv_data)
    csv_data = res.result
    date_keys = res.date_keys
    date = date_keys[date]

    day_value = get_day_value(csv_data, date)
    let max = day_value.reduce((prev, current) => {
        return parseFloat(prev[date]) > parseFloat(current[date]) ? prev : current
    })
    console.log( max)

    max =(parseFloat(max[date])*1.1)*100

    var grade_list = [
        0,
        (max*0.05).toFixed(2),
        (max*0.1).toFixed(2),
        (max*0.25).toFixed(2),
        (max*0.5).toFixed(2),
        (max*0.75).toFixed(2),
        (max*0.85).toFixed(2),
        (max).toFixed(2),
    ]
    // console.log( grade_list)

    // console.log( max)
    // console.log( day_value)

    geoJson_data = {
        type: 'FeatureCollection',
        features: geoJson_data.features.map(feature => {
            const d = day_value.find(d => d.index === feature.properties.index);

            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    date_value: d[date],
                    color: getColor(d[date], grade_list)
                }
            };
        })
    };
    // console.log( date)

    return { geoJson_data, date , grade_list}
}

async function display_region(geoJson_data, region, scope, grade_list) {
    // map.invalidateSize();

    function polystyle(feature) {
        return {
            fillColor: feature.properties.color,
            weight: 0.5,
            opacity: 0.5,
            color: '#dddddd',  //Outline color
            fillOpacity: 0.7
        };
    }

    function highlightFeature(e) {
        var layer = e.target;

        layer.setStyle({
            weight: 3,
            color: '#272727',
            dashArray: '',
            fillOpacity: 0.8
        });

        layer.bringToFront();
        info.update(layer.feature.properties);
    }

    function resetHighlight(e) {
        geoJson_data.resetStyle(e.target);
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }
    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature
        });
    }

    geoJson_data = L.geoJson(geoJson_data,
        {
            style: polystyle,
            onEachFeature: onEachFeature
        }).addTo(map);

    var info = L.control();

    info.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
        this.update();
        return this._div;
    };

    // method that we will use to update the control based on feature properties passed
    info.update = function (props) {
        this._div.innerHTML = `<h4>${region} </h4> <p> Regional Emission Intensity </p> <p> Scope  ${scope} </p> <p>` + (props ?
            '<b>' + (props.date_value * 100).toFixed(2) + ' (%) of the Region </b><br /> </p>'
            : 'Hover over a grid');
    };

    info.addTo(map);


    var legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            grades = grade_list.map(x=>(x/100)),
            labels = [];

        // loop through our density intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(grades[i], grade_list ) + '"></i> ' +
                (grades[i]*100).toFixed(2) + (grades[i + 1] ? '&ndash;' + (grades[i+1]*100).toFixed(2) + '<br>' : '+');
        }

        return div;
    };

    legend.addTo(map);

    map.fitBounds(geoJson_data.getBounds());

    //   var marker = L.marker([51.5, -0.09]).addTo(map);
    // var polygon = L.polygon([
    //     [51.509, -0.08],
    //     [51.503, -0.06],
    //     [51.51, -0.047]
    // ], {
    //     color: 'red',
    //     fillColor: '#f03',
    //     fillOpacity: 0.5,
    // }).addTo(map);
    // polygon.bindPopup("I am a polygon.");


}

function init_map() {
    var map = L.map('map').setView([0, 0], 0);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // var popup = L.popup();

    // function onMapClick(e) {
    //     popup
    //         .setLatLng(e.latlng)
    //         .setContent("You clicked the map at " + e.latlng.toString())
    //         .openOn(map);
    // }

    // map.on('click', onMapClick);

    return map
}