{
    "routes" : [
        {
            "sourceRoute": "/interface/v1/event/create",
            "type": "POST",
            "priority": "MUST_HAVE",
            "inSequence": false,
            "orchestrated": false,
            "targetPackages": [
                {
                    "basePackageName": "event",
                    "packageName": "shiksha-event"
                }
            ]
        },
        {
            "sourceRoute": "/interface/v1/event/:id",
            "type": "POST",
            "priority": "MUST_HAVE",
            "inSequence": false,
            "orchestrated": false,
            "targetPackages": [
                {
                    "basePackageName": "event",
                    "packageName": "shiksha-event"
                }
            ]
        },
        {
            "sourceRoute": "/interface/v1/event/list",
            "type": "PATCH",
            "priority": "MUST_HAVE",
            "inSequence": false,
            "orchestrated": false,
            "targetPackages": [
                {
                    "basePackageName": "event",
                    "packageName": "shiksha-event"
                }
            ]
        }
    ]
}

