// Browser-compatible RtcTokenBuilder2.js

// Load AccessToken2 and services - required for token building
let AccessToken2, ServiceRtc, ServiceRtm;
if (typeof window === 'undefined') {
  // Node.js environment
  const AccessToken2Module = require('./AccessToken2.js');
  AccessToken2 = AccessToken2Module.AccessToken2;
  ServiceRtc = AccessToken2Module.ServiceRtc;
  ServiceRtm = AccessToken2Module.ServiceRtm;
} else {
  // Browser environment - should be loaded via script tag
  AccessToken2 = window.AccessToken2;
  ServiceRtc = window.ServiceRtc;
  ServiceRtm = window.ServiceRtm;
}

const Role = {
    PUBLISHER: 1,
    SUBSCRIBER: 2
}

class RtcTokenBuilder {
    static async buildTokenWithUid(appId, appCertificate, channelName, uid, role, tokenExpire, privilegeExpire = 0) {
        return await this.buildTokenWithUserAccount(
            appId,
            appCertificate,
            channelName,
            uid,
            role,
            tokenExpire,
            privilegeExpire
        )
    }

    static async buildTokenWithUserAccount(
        appId,
        appCertificate,
        channelName,
        account,
        role,
        tokenExpire,
        privilegeExpire = 0
    ) {
        let token = new AccessToken2(appId, appCertificate, 0, tokenExpire)

        let serviceRtc = new ServiceRtc(channelName, account)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegeJoinChannel, privilegeExpire)
        if (role == Role.PUBLISHER) {
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishAudioStream, privilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishVideoStream, privilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishDataStream, privilegeExpire)
        }
        token.add_service(serviceRtc)

        return await token.build()
    }

    static async buildTokenWithUidAndPrivilege(
        appId,
        appCertificate,
        channelName,
        uid,
        tokenExpire,
        joinChannelPrivilegeExpire,
        pubAudioPrivilegeExpire,
        pubVideoPrivilegeExpire,
        pubDataStreamPrivilegeExpire
    ) {
        return await this.BuildTokenWithUserAccountAndPrivilege(
            appId,
            appCertificate,
            channelName,
            uid,
            tokenExpire,
            joinChannelPrivilegeExpire,
            pubAudioPrivilegeExpire,
            pubVideoPrivilegeExpire,
            pubDataStreamPrivilegeExpire
        )
    }

    static async BuildTokenWithUserAccountAndPrivilege(
        appId,
        appCertificate,
        channelName,
        account,
        tokenExpire,
        joinChannelPrivilegeExpire,
        pubAudioPrivilegeExpire,
        pubVideoPrivilegeExpire,
        pubDataStreamPrivilegeExpire
    ) {
        let token = new AccessToken2(appId, appCertificate, 0, tokenExpire)

        let serviceRtc = new ServiceRtc(channelName, account)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegeJoinChannel, joinChannelPrivilegeExpire)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishAudioStream, pubAudioPrivilegeExpire)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishVideoStream, pubVideoPrivilegeExpire)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishDataStream, pubDataStreamPrivilegeExpire)
        token.add_service(serviceRtc)

        return await token.build()
    }

    static async buildTokenWithRtm(appId, appCertificate, channelName, account, role, tokenExpire, privilegeExpire = 0) {
        let token = new AccessToken2(appId, appCertificate, 0, tokenExpire)

        let serviceRtc = new ServiceRtc(channelName, account)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegeJoinChannel, privilegeExpire)
        if (role == Role.PUBLISHER) {
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishAudioStream, privilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishVideoStream, privilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishDataStream, privilegeExpire)
        }
        token.add_service(serviceRtc)

        let serviceRtm = new ServiceRtm(account)
        serviceRtm.add_privilege(ServiceRtm.kPrivilegeLogin, tokenExpire)
        token.add_service(serviceRtm)

        return await token.build()
    }

    static async buildTokenWithRtm2(
        appId,
        appCertificate,
        channelName,
        rtcAccount,
        rtcRole,
        rtcTokenExpire,
        joinChannelPrivilegeExpire,
        pubAudioPrivilegeExpire,
        pubVideoPrivilegeExpire,
        pubDataStreamPrivilegeExpire,
        rtmUserId,
        rtmTokenExpire
    ) {
        let token = new AccessToken2(appId, appCertificate, 0, rtcTokenExpire)

        let serviceRtc = new ServiceRtc(channelName, rtcAccount)
        serviceRtc.add_privilege(ServiceRtc.kPrivilegeJoinChannel, joinChannelPrivilegeExpire)
        if (rtcRole == Role.PUBLISHER) {
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishAudioStream, pubAudioPrivilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishVideoStream, pubVideoPrivilegeExpire)
            serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishDataStream, pubDataStreamPrivilegeExpire)
        }
        token.add_service(serviceRtc)

        let serviceRtm = new ServiceRtm(rtmUserId)
        serviceRtm.add_privilege(ServiceRtm.kPrivilegeLogin, rtmTokenExpire)
        token.add_service(serviceRtm)

        return await token.build()
    }
}

// Browser exports
if (typeof window !== 'undefined') {
  window.RtcTokenBuilder = RtcTokenBuilder
  window.RtcRole = Role
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RtcTokenBuilder, RtcRole: Role }
}
