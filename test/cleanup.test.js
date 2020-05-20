import {
  cleanupChatChannels,
  findStaleChatSessions
 } from '../src/cleanup';

let twilio;
let channelUpdateMock = jest.fn();
let channelFetchMock = jest.fn();
let proxyGetNextPageUrlMock = jest.fn();
let proxyNextPageMock = jest.fn();
let proxyPageMock = pageMock(proxyGetNextPageUrlMock, proxyNextPageMock)

let tasksGetNextPageUrlMock = jest.fn();
let tasksNextPageMock = jest.fn();
let tasksPageMock = pageMock(tasksGetNextPageUrlMock, tasksNextPageMock);

beforeEach(() => {
  channelUpdateMock.mockReset();
  channelFetchMock.mockReset();
  tasksPageMock.mockReset();
  proxyPageMock.mockReset();
  proxyNextPageMock.mockReset();
  proxyGetNextPageUrlMock.mockReset();
  tasksGetNextPageUrlMock.mockReset();
  tasksNextPageMock.mockReset();
  tasksPageMock.mockReset();

  twilio = {
    taskrouter: {
      workspaces: wsid => ({
        tasks: {
          page: tasksPageMock,
        }
      })
    },
    proxy: {
      services: ssid => ({
        sessions: {
          page: proxyPageMock
        }
      })
    },
    chat: {
      services: ssid => ({
        channels: csid => ({
          update: channelUpdateMock,
          fetch: channelFetchMock,
        })
      })
    }
  };
});

test('should cleanup active orphaned channels', async () => {
  const status = jest.fn();
  const sids = [
    "CH114ff411c17045feb7e917c71278772b",
    "CH114ff411c17045feb7e917c71278772a",
    "CH114ff411c17045feb7e917c71278772c"
  ];

  channelFetchMock
    .mockReturnValueOnce(channel(sids[0], {
      status: "ACTIVE",
      otherKey: "hello"
    }))
    .mockReturnValueOnce(channel(sids[1], { status: "INACTIVE" }))
    .mockReturnValueOnce(channel(sids[1], { status: "ACTIVE" }))

  const serviceSid = "IS114ff411c17045feb7e917c71278772a";
  const out = await cleanupChatChannels(status, twilio, sids, serviceSid)

  expect(out.updated).toBe(2);
  expect(out.cleanedUpChannels).toEqual([
    "CH114ff411c17045feb7e917c71278772b",
    "CH114ff411c17045feb7e917c71278772c"
  ]);
  expect(channelUpdateMock.mock.calls.length).toBe(2);
  expect(channelUpdateMock.mock.calls[0][0]).toEqual({
    attributes: JSON.stringify({
      status: 'INACTIVE',
      otherKey: 'hello'
    })
  });
  expect(channelUpdateMock.mock.calls[1][0]).toEqual({
    attributes: JSON.stringify({
      status: 'INACTIVE',
    })
  })
});

test('should find stale chat sessions and ignore live ones', async () => {
  const status = jest.fn();
  const flexWorkspace = 'WS114ff411c17045feb7e917c71278772c';
  const flexProxyServices = 'KS73410864ac7e0348e3373d751d6b7133';

  const staleChannels = [
    "CH114ff411c17045feb7e917c71278772a",
    "CH114ff411c17045feb7e917c71278772b"
  ];

  const liveChannels = [
    "CH114ff411c17045feb7e917c71278772c",
    "CH114ff411c17045feb7e917c71278772d",
  ];

  const tasks = [
    taskWithChannelAttr(liveChannels[0]),
    taskWithChannelAttr(null),
    taskWithChannelAttr(liveChannels[1])
  ]

  const moreTasks = [
    taskWithChannelAttr('randomstr')
  ];

  tasksPageMock.mockReturnValueOnce({
    instances: tasks,
    getNextPageUrl: () => 'url.com',
    nextPage: () => ({
      instances: moreTasks,
      getNextPageUrl: () => null
    })
  });

  const proxySessions = [
    proxySession(staleChannels[0]),
    proxySession(staleChannels[1]),
    proxySession('random-name'),
    proxySession(liveChannels[0]),
    proxySession(liveChannels[1]),
  ];

  proxyPageMock.mockReturnValueOnce({
    instances: proxySessions,
    getNextPageUrl: () => null
  });

  const res = await findStaleChatSessions(status, twilio, flexWorkspace, flexProxyServices);
  expect(res.orphanedChannelSids).toEqual(staleChannels)
})

function channel(sid, attrs) {
  return {
  "uniqueName": null,
  "membersCount": 0,
  "dateUpdated": "2020-05-19T21:52:51Z",
  "createdBy": "system",
  "accountSid": "AC46f5800fe49d2b4c4a1c9275381a8afb",
  "sid": sid,
  "attributes": JSON.stringify(attrs),
  "serviceSid": "IS714d434b35a04eb2808ffb3980b64ec0"
  }
}

function proxySession(channelSid, isOpen = true) {
  return {
      "status": isOpen ? 'open' : 'closed',
      "uniqueName": channelSid,
      "closedReason": null,
      "dateEnded": null,
      "ttl": 0,
      "sid": "KC92ee0d0c7a820f98eb318ceba03b817d",
      "dateExpiry": null,
      "accountSid": "AC46f5800fe49d2b4c4a1c9275381a8afb",
      "dateUpdated": "2020-05-19T21:51:34Z",
      "mode": "voice-and-message",
      "dateLastInteraction": null,
      "dateCreated": "2020-05-19T21:51:34Z",
      "dateStarted": null,
      "serviceSid": "KS73410864ac7e0348e3373d751d6b7133",
  };
}

function taskWithChannelAttr(channelSid) {
  return {
      "workspaceSid": "WSe3f3b39e7e51604083645063734a2d9a",
      "assignmentStatus": "completed",
      "dateUpdated": "2020-05-20T00:29:37Z",
      "taskQueueEnteredDate": "2020-05-20T00:29:19Z",
      "age": 21,
      "sid": "WT37f1f8187ea1220a57e6a868d18d2cf2",
      "accountSid": "AC46f5800fe49d2b4c4a1c9275381a8afb",
      "priority": 0,
      "url": "https://taskrouter.twilio.com/v1/Workspaces/WSe3f3b39e7e51604083645063734a2d9a/Tasks/WT37f1f8187ea1220a57e6a868d18d2cf2",
      "reason": "All reservations were completed",
      "taskQueueSid": "WQ9ca8a71a88b69bd2f1e3feac956750d6",
      "workflowFriendlyName": "Assign to Anyone",
      "timeout": 86400,
      "attributes": "{\"channelSid\":\"" + channelSid + "\",\"name\":\"Customer\",\"channelType\":\"sms\"}",
      "dateCreated": "2020-05-20T00:29:19Z",
      "taskChannelSid": "TC2ef6ec1222bba7785458f95ce7a012f4",
      "addons": "{}",
      "workflow_sid": "WW589d61d5193e15c8c99571708e40c7f5",
  };
}

function pageMock(getNextMock, getNextPageUrlMock) {
  return jest.fn(() => ({
    getNextPageUrl: getNextPageUrlMock,
    getNext: getNextMock,
  }));
}
