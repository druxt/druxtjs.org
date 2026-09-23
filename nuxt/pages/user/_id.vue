<template>
  <div>
    <DruxtUser :id="$route.params.id">
      <template #default="{ user, name, avatar, initials, roles, since }">
        <div v-if="user" class="max-w-content">
          <div class="flex items-center gap-4 mb-6">
            <AppAvatar :account="{ picture: avatar, initials, hue: hueOf(user.id) }" :size="64" />
            <div>
              <h1 class="text-3xl font-semibold tracking-tight">{{ name }}</h1>
              <p v-if="roles.length" class="text-base-content/70 text-sm mt-1">
                {{ roles.map((role) => role.label).join(', ') }}
              </p>
            </div>
          </div>

          <dl class="text-sm border border-base-300 rounded-lg divide-y divide-base-300">
            <div v-if="since" class="flex gap-4 px-4 py-3">
              <dt class="w-32 text-base-content/60">Member since</dt>
              <dd>{{ when(since) }}</dd>
            </div>
            <div class="flex gap-4 px-4 py-3">
              <dt class="w-32 text-base-content/60">Account</dt>
              <dd>{{ $route.params.id }}</dd>
            </div>
          </dl>

          <p v-if="isMine(user)" class="mt-6">
            <a :href="editHref" target="_self" class="link">Edit your profile and picture</a>
          </p>
        </div>

        <!-- Who may see a profile is Drupal's decision, and it said no. -->
        <div v-else class="max-w-content">
          <h1 class="text-3xl font-semibold tracking-tight mb-2">No profile to show</h1>
          <p class="text-base-content/70">
            This account does not exist, or it is not one you may view.
            <NuxtLink v-if="!signedIn" to="/login" class="link">Sign in</NuxtLink
            ><span v-if="!signedIn"> and try again.</span>
          </p>
        </div>
      </template>
    </DruxtUser>
  </div>
</template>

<script>
import { hueOf } from '~/lib/account'
import { seoHead } from '~/utils/seo'

/**
 * A user's profile, on the site rather than on the backend.
 *
 * `/user/2` is the path Drupal links to and it carries Drupal's own number
 * for the account, so the page hands that number to DruxtUser. A reader who
 * may not see the profile is told so, because who may see one is Drupal's
 * decision and this page does not second-guess it.
 */
export default {
  name: 'UserPage',

  computed: {
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),

    /** Drupal's form for the account, and back here once it is saved. */
    editHref() {
      return `/user/${this.$route.params.id}/edit?destination=${encodeURIComponent(this.$route.fullPath)}`
    },
  },

  methods: {
    hueOf,

    /**
     * Whether this profile is the reader's own.
     *
     * The token names the account by uuid, which is what the OpenID Connect
     * subject carries, so the comparison is with the user on the page rather
     * than with the number in the path.
     *
     * @param {object} user - The user on the page.
     * @returns {boolean} True where it is the reader's own profile.
     */
    isMine(user) {
      const me = (this.$auth || {}).user || {}
      return Boolean(me.sub) && me.sub === (user || {}).id
    },

    /** A date a reader reads, rather than an ISO 8601 string. */
    when(date) {
      const at = new Date(date)
      if (Number.isNaN(at.getTime())) return ''
      return at.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })
    },
  },

  head() {
    // A profile is not a page for a search engine: Drupal decides who may see
    // it, so it is never the same page twice and it is not indexed.
    const head = seoHead({
      title: 'Profile',
      description: 'A contributor profile on druxtjs.org.',
      path: this.$route.path,
      type: 'profile',
    })
    return {
      ...head,
      meta: [...(head.meta || []), { hid: 'robots', name: 'robots', content: 'noindex' }],
    }
  },
}
</script>
