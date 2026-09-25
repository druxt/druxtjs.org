<script>

import DruxtModule from 'druxt/dist/components/DruxtModule.vue'
import { DrupalJsonApiParams } from 'drupal-jsonapi-params'
import { mapActions } from 'vuex'

// The reading, by a relative path that survives the build: `exports` maps
// `./lib/*`, so mkdist copies `src/lib/profile.js` to `dist/lib/profile.mjs`
// beside the component. Importing the package by name instead would pull the
// index, which is the Nuxt module, and put Node's `path` in a reader's bundle.
import {
  emailHash,
  gravatarUrl,
  initialsOf,
  nameOf,
  pictureOf,
  rolesOf,
  sinceOf,
} from '../lib/profile'

/** What a profile needs from Drupal, and nothing else. */
const INCLUDE = ['user_picture', 'roles']

/**
 * Renders a Drupal user.
 *
 * Drupal identifies a user three ways, and a decoupled site runs into each of
 * them: a uuid in JSON:API, the number in the path Drupal links to
 * (`/user/2`), and whoever is signed in. Only the first is one `DruxtEntity`
 * can take, so this takes any of the three.
 *
 * It reads the profile out of the resource too: the name Drupal shows, the
 * picture, the roles with their labels, and when the account was made. A
 * reader with no picture has their initials, and a site that asks for it can
 * fall back to a gravatar first.
 *
 * A user Drupal will not show the reader is not an error to handle: `user` is
 * undefined and the wrapper renders nothing, because who may see a profile is
 * Drupal's decision.
 *
 * @example @lang vue
 * <DruxtUser :uuid="uuid" />
 *
 * @example <caption>By the number in the path</caption> @lang vue
 * <DruxtUser :id="$route.params.id" />
 *
 * @example <caption>Whoever is signed in</caption> @lang vue
 * <DruxtUser me />
 *
 * @example <caption>Your own markup</caption> @lang vue
 * <DruxtUser me>
 *   <template #default="{ name, avatar, roles, since }">
 *     <img v-if="avatar" :src="avatar" :alt="name" />
 *     <h1>{{ name }}</h1>
 *     <p>{{ roles.map((role) => role.label).join(', ') }}</p>
 *     <p>Here since {{ since }}</p>
 *   </template>
 * </DruxtUser>
 */
export default {
  name: 'DruxtUser',

  extends: DruxtModule,

  props: {
    /**
     * The user's JSON:API uuid.
     *
     * @type {string}
     */
    uuid: {
      type: String,
      default: undefined,
    },

    /**
     * The user's number in Drupal, the one in `/user/2`.
     *
     * @type {(number|string)}
     */
    id: {
      type: [Number, String],
      default: undefined,
    },

    /**
     * Render whoever is signed in.
     *
     * The uuid comes from the authenticated user's OpenID Connect subject,
     * which is where Drupal's Simple OAuth puts it. A site whose
     * authentication says it another way passes `subjectKey`.
     *
     * @type {boolean}
     */
    me: {
      type: Boolean,
      default: false,
    },

    /** Where the signed-in user's uuid is on the authenticated user. */
    subjectKey: {
      type: String,
      default: 'sub',
    },

    /** The relationships to load with the user. */
    include: {
      type: Array,
      default: () => INCLUDE,
    },

    /** The image field holding the user's picture. */
    pictureField: {
      type: String,
      default: 'user_picture',
    },

    /**
     * Whether a reader with no picture falls back to their gravatar.
     *
     * Off unless a site asks for it. The address is hashed in the browser and
     * only the hash is sent, but the request still tells a third party that
     * this site rendered this person, from the reader's own browser and with
     * their address. A hash is not anonymity either: addresses are
     * enumerable, and hashes of common ones are published. That is a fine
     * trade for some sites and unacceptable for others, so it is the site's
     * to make.
     */
    gravatar: {
      type: Boolean,
      default: false,
    },

    /** The size to ask gravatar for, in pixels. */
    gravatarSize: {
      type: Number,
      default: 96,
    },

    /**
     * Drupal display mode.
     *
     * @type {string}
     * @default default
     */
    mode: {
      type: String,
      default: 'default',
    },

    /**
     * The JSON:API resource type, for a site with more than one user type.
     *
     * @type {string}
     * @default user--user
     */
    type: {
      type: String,
      default: 'user--user',
    },
  },

  data: () => ({
    /** The user resource, or undefined where there is none to show. */
    user: undefined,
    /** The resources Drupal sent with it: the picture, the roles. */
    included: [],
    /** The gravatar, once the browser has hashed the address. */
    gravatarSrc: null,
  }),

  computed: {
    /** The name Drupal shows for this user. */
    name() {
      return nameOf(this.user)
    },

    /** One or two letters, for a reader with no picture and no gravatar. */
    initials() {
      return initialsOf(this.name)
    },

    /** The user's picture, where the site included it. */
    picture() {
      return pictureOf(this.user, this.included, this.pictureField)
    },

    /** The picture, else the gravatar, else nothing. */
    avatar() {
      return this.picture || this.gravatarSrc || null
    },

    /** The user's roles, with the labels Drupal gave them. */
    roles() {
      return rolesOf(this.user, this.included)
    },

    /** When the account was made, where the reader may see it. */
    since() {
      return sinceOf(this.user)
    },

    /** The uuid of the user on screen. */
    resolvedUuid() {
      return (this.user || {}).id
    },
  },

  watch: {
    user() {
      this.resolveGravatar()
    },
  },

  mounted() {
    // Hashing is the browser's, so the gravatar arrives after the page does.
    this.resolveGravatar()
  },

  methods: {
    ...mapActions({
      getCollection: 'druxt/getCollection',
      getResource: 'druxt/getResource',
    }),

    /** The signed-in user's uuid, where a site has authentication. */
    myUuid() {
      const me = (this.$auth || {}).user || {}
      return me[this.subjectKey] || me.uuid || undefined
    },

    /**
     * The query that loads a profile: the user, and what it is made of.
     *
     * A `DrupalJsonApiParams`, because that is what the Druxt store's query
     * takes. A plain object looks like it works and does not: its filter
     * serialises to `filter=` and the request comes back a 400, which the
     * resolver above swallows, so the profile renders as nothing at all.
     *
     * @param {(number|string)} [id] - A user's number in Drupal, to filter by.
     * @returns {DrupalJsonApiParams} The query.
     */
    query(id) {
      const query = new DrupalJsonApiParams()
      if (this.include.length) query.addInclude(this.include)
      if (id !== undefined && id !== null && id !== '') {
        query.addFilter('drupal_internal__uid', String(id))
      }
      return query
    },

    /**
     * Gravatar's address for this user, once the browser has hashed the
     * email.
     *
     * Drupal sends the address only to a reader allowed to see it, so most
     * readers get no gravatar and keep their initials.
     */
    async resolveGravatar() {
      this.gravatarSrc = null
      const mail = ((this.user || {}).attributes || {}).mail
      if (!this.gravatar || !mail) return
      // The browser's, deliberately: on the server there is nothing to hash
      // with, and the gravatar arrives with the page's first render instead.
      const crypto = typeof window === 'undefined' ? null : window.crypto
      const hash = await emailHash(mail, (crypto || {}).subtle)
      this.gravatarSrc = gravatarUrl(hash, { size: this.gravatarSize })
    },

    /**
     * Keeps the resource and whatever Drupal sent with it.
     *
     * The store hands back the JSON:API document, not the resource, and a
     * profile is made of both: the user is in `data` and its picture and
     * roles are in `included`.
     *
     * @param {object} result - What `druxt/getResource` returned.
     */
    take(result) {
      this.user = (result || {}).data
      this.included = (result || {}).included || []
    },

    /** The one user with this number in Drupal, or none. */
    async byId(id) {
      const collection = await this.getCollection({
        type: this.type,
        query: this.query(id),
      })
      this.user = ((collection || {}).data || [])[0]
      this.included = (collection || {}).included || []
    },
  },

  /**
   * Druxt hooks.
   */
  druxt: {
    /** Fetches the user, by whichever of the three the site gave. */
    async fetchData() {
      const uuid = this.uuid || (this.me ? this.myUuid() : undefined)
      try {
        if (uuid) {
          this.take(
            await this.getResource({
              type: this.type,
              id: uuid,
              query: this.query(),
            })
          )
          return
        }
        if (this.id !== undefined && this.id !== null && this.id !== '') {
          await this.byId(this.id)
        }
      } catch (e) {
        // Drupal decides who may see a profile, and it said no. The wrapper
        // renders nothing rather than the site showing an error for a rule.
        this.user = undefined
        this.included = []
      }
    },

    /**
     * The component naming options for the Druxt wrapper.
     *
     * @param {object} context - The module component ViewModel.
     * @returns {ComponentOptions}
     */
    componentOptions: ({ mode, type }) => [
      // DruxtUser[ResourceType][Mode]
      [type, mode],
      // DruxtUser[Mode]
      [mode],
      ['default'],
    ],

    /**
     * The props for the wrapper component.
     *
     * @param {object} context - The module component ViewModel.
     * @returns {object}
     */
    propsData: ({
      avatar,
      initials,
      mode,
      name,
      picture,
      resolvedUuid,
      roles,
      since,
      type,
      user,
    }) => ({
      avatar,
      initials,
      mode,
      name,
      picture,
      roles,
      since,
      type,
      user,
      uuid: resolvedUuid,
    }),

    /**
     * The scoped slots.
     *
     * The default renders the display Drupal is configured to render for the
     * mode asked for, which is the point: a site gets what its backend
     * already says a user looks like, and replaces the slot when it wants
     * something else.
     *
     * @param {Function} h - The Vue hyperscript function.
     * @returns {ScopedSlots}
     */
    slots(h) {
      return {
        default: () =>
          this.resolvedUuid
            ? h('DruxtEntity', {
                props: {
                  type: this.type,
                  uuid: this.resolvedUuid,
                  mode: this.mode,
                },
              })
            : undefined,
      }
    },
  },
}
</script>
